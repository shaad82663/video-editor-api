const redis = require("redis");
const path = require("path");
const fs = require("fs");
const {
  trimVideo,
  addSubtitles,
  formatTimeForSRT,
  getDirPath,
  getLatestUnconfirmedFilePath,
} = require("./helper");
const logger = require("./logger");
const { Video, EditOperation } = require("../models/index");
const { REDIS, EDITING_OPERATIONS } = require("../config/constants");

// Create Redis publisher and subscriber
const publisher = redis.createClient({
  socket: {
    host: "localhost",
    port: 6379,
  },
});

const subscriber = redis.createClient({
  socket: {
    host: "localhost",
    port: 6379,
  },
});

// Redis queue key for jobs
const videoProcessingQueueKey = "video_processing_queue";

// publishJob function
const publishJob = async (channel, job) => {
  await publisher.publish(channel, JSON.stringify(job));
};

// Lock video processing to avoid race conditions (mutex)
const acquireLock = async (videoId) => {
  const lockKey = `${REDIS.VIDEO_LOCK}:${videoId}`;
  const lockAcquired = await publisher.setNX(lockKey, "locked", "EX", 3600); // Lock expires in 1 hour
  return lockAcquired;
};

const isEditingVideo = async (videoId) => {
  const lockKey = `${REDIS.VIDEO_LOCK}:${videoId}`;
  const lockStatus = await publisher.get(lockKey);

  return lockStatus === "locked";
};

const releaseLock = async (videoId) => {
  const lockKey = `${REDIS.VIDEO_LOCK}:${videoId}`;
  await publisher.del(lockKey); // Release the lock
};

// Process job function
const runJob = async (job) => {
  const { operationType } = job;
  switch (operationType) {
    case EDITING_OPERATIONS.TRIM:
      await processTrimJob(job);
      break;
    case EDITING_OPERATIONS.SUBTITLE:
      await processSubtitleJob(job);
      break;
    default:
      logger.error(`Unknown operation type: ${operationType}`);
  }
};

// Process trim job function
const processTrimJob = async (job) => {
  const { videoId, inputPath, start, duration, outputPath, editId } = job;

  try {
    const video = await Video.findByPk(videoId);
    if (!video) {
      logger.error(`VideoId: #${videoId} not found`);
      return;
    }

    let finalInputPath = inputPath;
    if (video.unconfirmed_file_path) {
      // [file handling stuff] -> if unconfirmed file path exists -> some editing operation is already done -> we need to use that file
      const directoryPath = path
        .dirname(inputPath)
        .replace("uploads", "unconfirmed");
      newPath = path.join(directoryPath, `${video.unconfirmed_file_path}`);
      finalInputPath = newPath;
    }

    const editOperation = await EditOperation.findOne({
      where: { id: editId },
    });

    if (!editOperation) {
      logger.error("EditOperation not found");
      return;
    }

    const trimmedVideoPath = await trimVideo(
      finalInputPath,
      start,
      duration,
      outputPath
    );

    video.unconfirmed_file_path = path.basename(trimmedVideoPath);
    editOperation.has_processed = true;
    await video.save();
    await editOperation.save();

    logger.info(
      `Video with id: ${videoId} trimmed successfully: Operation Id ${editId}`
    );
  } catch (error) {
    logger.error("Error processing trim job:", error);
  }
};

// Process subtitle job function
const processSubtitleJob = async (job) => {
  const {
    videoId,
    inputPath,
    outputPath,
    subtitleData,
    editId,
    outPutFileName,
  } = job;
  const { text, start, end } = subtitleData;

  try {
    const video = await Video.findByPk(videoId);
    if (!video) {
      logger.error(`VideoId: #${videoId} not found`);
      return;
    }
    let finalInputPath = inputPath; // By default, use the inputPath
    let newPath;
    if (video.unconfirmed_file_path) {
      // [file handling stuff] -> if unconfirmed file path exists -> some editing operation is already done -> we need to use that file
      const directoryPath = path
        .dirname(inputPath)
        .replace("uploads", "unconfirmed");
      newPath = path.join(
        directoryPath,
        `${video.unconfirmed_file_path}`
      );
      finalInputPath = newPath;
    }

    const editOperation = await EditOperation.findByPk(editId);
    if (!editOperation) {
      logger.error(`EditOperation not found for ID: ${editId}`);
      return;
    }

    //  Create subtitle content
    const subtitleContent = `1\n${formatTimeForSRT(
      start
    )} --> ${formatTimeForSRT(end)}\n${text}\n`;

    let baseFolder = await getDirPath("upload", video.id);
    let subtitleTempPath = path.join(baseFolder, `subtitle_${Date.now()}.srt`);

    await fs.promises.writeFile(subtitleTempPath, subtitleContent);

    //  Add subtitles to the video
    await addSubtitles(finalInputPath, subtitleTempPath, outputPath);

    //  Update database
    video.unconfirmed_file_path = path.basename(outputPath);
    editOperation.has_processed = true;
    await video.save();
    await editOperation.save();

    logger.info(
      `Subtitle added to videoId: ${videoId} successfully. EditId: ${editId}`
    );
  } catch (error) {
    logger.error("Error processing subtitle job:", error);
  }
};

// Function to add job to Redis queue
const addToQueue = async (videoId, job) => {
  await publisher.rPush(
    videoProcessingQueueKey,
    JSON.stringify({ videoId, job })
  );
};

// Process the next job in the queue for a particular video
const processNextJob = async (videoId) => {
  const nextJob = await publisher.lPop(videoProcessingQueueKey);
  if (nextJob) {
    const job = JSON.parse(nextJob);
    await processJob(job);
  }
};

const clearQueue = async () => {
  try {
    await publisher.del(videoProcessingQueueKey);
    logger.info(`Redis Queue cleared successfully!`);
  } catch (error) {
    logger.error("Error clearing the queue:", error);
  }
};

// Process job and handle locking
const processJob = async (jobData) => {
  const { videoId, job } = jobData;
  try {
    // await releaseLock(videoId);
    const lockAcquired = await acquireLock(videoId);
    if (!lockAcquired) {
      logger.info(`Video ${videoId} is already being processed. Queuing job.`);
      await addToQueue(videoId, job);
      return;
    }

    logger.info(
      `Processing job for videoId: ${videoId}, Operation: ${job.operationType}...`
    );
    // Process the job
    await runJob(job);

    // Release the lock and process next job in the queue
    await releaseLock(videoId);
    await processNextJob(videoId);
  } catch (error) {
    logger.error(`Error processing job for video ${videoId}: ${error.message}`);
  }
};

// Subscribe to the Redis job queue
(async () => {
  try {
    await publisher.connect();
    await subscriber.connect();
    clearQueue();
    logger.info("Redis publisher and subscriber connected");

    await subscriber.subscribe(REDIS.QUEUE, async (message) => {
      const job = JSON.parse(message);
      const { videoId } = job;

      // Add job to the Redis queue for that video
      await addToQueue(videoId, job);

      // Process the first job in the queue
      await processNextJob(videoId);
    });
  } catch (error) {
    logger.error("Error setting up Redis clients:", error);
  }
})();

module.exports = {
  publisher,
  subscriber,
  publishJob,
  isEditingVideo,
};
