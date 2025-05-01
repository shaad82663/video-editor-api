const fs = require("fs");
const path = require("path");
const _ = require("lodash");

const { Video, EditOperation } = require("../models");
const { publishJob } = require("../utils/redis");
const {
  getVideoDuration,
  parseTimeToSeconds,
  getDirPath,
  getFileType,
  getFilePaths,
  cleanupTempFiles,
} = require("../utils/helper");
const logger = require("../utils/logger");
const { EDITING_OPERATIONS, REDIS, MEDIA_DIR } = require("../config/constants");

const uploadVideo = async (req, res, next) => {
  try {
    const { originalname, size, path: filePath } = req.file;
    const videoName = originalname.split(".")[0];
    const duration = await getVideoDuration(filePath);

    const filename = path.basename(filePath);

    const video = await Video.create({
      name: videoName,
      duration,
      size,
      file_path: filename,
      metadata: null,
      file_type: getFileType(req.file.mimetype),
    });

    logger.info(`Video uploaded successfully: ${videoName}`);
    res.status(201).json({ message: "Video uploaded successfully", video });
  } catch (error) {
    logger.error(`Error uploading video: ${error.message}`);
    next(error);
  }
};

const trimVideoController = async (req, res, next) => {
  const { id } = req.params;
  const { start, end } = req.body;

  try {
    const video = await Video.findByPk(id);
    if (!video) return res.status(404).json({ message: "Video not found" });

    if (end > video.duration) {
      return res
        .status(400)
        .json({ message: "End time exceeds video duration" });
    }

    const { inputPath, outputPath } = await getFilePaths(
      video,
      EDITING_OPERATIONS.TRIM
    );
    const startSeconds = parseTimeToSeconds(start);
    const endSeconds = parseTimeToSeconds(end);
    const duration = endSeconds - startSeconds;

    const editOperation = await EditOperation.create({
      video_id: id,
      operation_type: EDITING_OPERATIONS.TRIM,
      parameters: { start, end, duration },
      file_path: outputPath,
    });

    publishJob(REDIS.QUEUE, {
      videoId: id,
      inputPath,
      outputPath,
      start,
      duration,
      editId: editOperation.id,
      operationType: editOperation.operation_type,
    });

    res.status(200).json({ message: "Trim operation started", editOperation });
  } catch (err) {
    next(err);
  }
};

const addSubtitlesController = async (req, res, next) => {
  const { id } = req.params;
  const { text, start, end } = req.body;

  try {
    const video = await Video.findByPk(id);
    if (!video) return res.status(404).json({ message: "Video not found" });

    const { inputPath, outputPath } = await getFilePaths(
      video,
      EDITING_OPERATIONS.SUBTITLE
    );

    const editOperation = await EditOperation.create({
      video_id: id,
      operation_type: EDITING_OPERATIONS.SUBTITLE,
      parameters: { text, start, end },
      file_path: outputPath,
    });

    publishJob(REDIS.QUEUE, {
      videoId: id,
      inputPath,
      outputPath,
      subtitleData: { text, start, end },
      editId: editOperation.id,
      operationType: editOperation.operation_type,
    });

    res.status(200).json({
      message: "Subtitle operation logged successfully",
      editOperation,
    });
  } catch (err) {
    next(err);
  }
};

const renderVideoController = async (req, res, next) => {
  const { id } = req.params;

  try {
    const video = await Video.findByPk(id, {
      include: [
        {
          model: EditOperation,
          where: { has_processed: false },
          required: false,
        },
      ],
    });

    if (!video) {
      return res.status(404).json({ message: "Video not found" });
    }

    const unprocessedEdits = video.EditOperations;
    if (!_.isEmpty(unprocessedEdits)) {
      logger.warn(`Video with ID: ${id} has ongoing edits...`);
    }

    let filePath;
    if (video.unconfirmed_file_path) {
      // case: return edited video
      const dirPath = await getDirPath(MEDIA_DIR.UNCONFIRMED, video.id);
      filePath = path.join(dirPath, video.unconfirmed_file_path);
    } else {
      // case: return original video
      const dirPath = await getDirPath(MEDIA_DIR.UPLOAD);
      filePath = path.join(dirPath, video.file_path);
    }

    if (!fs.existsSync(filePath)) {
      return res
        .status(404)
        .json({ message: "Video file not found on the server" });
    }

    const mimeType =
      video.file_type === "mov" ? "video/quicktime" : "video/mp4";
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Accept-Ranges", "bytes");

    const videoStream = fs.createReadStream(filePath);

    videoStream.pipe(res);

    videoStream.on("error", (err) => {
      logger.error("Error streaming video:", err);
      res.status(500).json({ message: "Error streaming video" });
    });

    videoStream.on("end", () => {
      logger.info(`Video with ID: ${id} successfully sent.`);
    });
  } catch (error) {
    logger.error("Error initiating render job:", error);
    next(error);
  }
};

const downloadVideoController = async (req, res, next) => {
  const { id } = req.params;
  const { deleteTempFile } = req.body || false;

  try {
    const video = await Video.findByPk(id, {
      include: [
        {
          model: EditOperation,
          where: { has_processed: false },
          required: false,
        },
      ],
    });

    if (!video) {
      return res.status(404).json({ message: "Video not found" });
    }

    const unprocessedEdits = video.EditOperations;
    if (!_.isEmpty(unprocessedEdits)) {
      logger.warn(`Video with ID: ${id} has ongoing edits...`);
    }

    let filePath;

    if (video.unconfirmed_file_path) {
      // case: return edited video
      const dirPath = await getDirPath(MEDIA_DIR.UNCONFIRMED, video.id);
      filePath = path.join(dirPath, video.unconfirmed_file_path);
    } else {
      // case: return original video
      const dirPath = await getDirPath(MEDIA_DIR.UPLOAD);
      filePath = path.join(dirPath, video.file_path);
    }
    if (!fs.existsSync(filePath)) {
      return res
        .status(404)
        .json({ message: "Video file not found on server" });
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const fileType =
      video.file_type === "mov" ? "video/quicktime" : "video/mp4";

    res.setHeader("Content-Type", fileType);
    res.setHeader("Content-Length", fileSize);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${video.title || `video_${id}`}.${
        video.file_type
      }"`
    );

    const fileStream = fs.createReadStream(filePath);

    fileStream.pipe(res);

    fileStream.on("error", (err) => {
      logger.error("Error downloading video:", err);
      res.status(500).json({ message: "Error downloading video" });
    });

    fileStream.on("end", () => {
      logger.info(`Video with ID: ${id} successfully downloaded.`);
      if (deleteTempFile) {
        cleanupTempFiles(video.id, video.file_path)
          .then(() => {
            logger.info(`Temporary files for video with ID: ${id} cleaned up.`);
          })
          .catch((err) => {
            logger.error("Error cleaning up temporary files:", err);
          });
      }
    });
  } catch (error) {
    logger.error("Error handling video download:", error);
    next(error);
  }
};

module.exports = {
  uploadVideo,
  trimVideoController,
  addSubtitlesController,
  renderVideoController,
  downloadVideoController,
};
