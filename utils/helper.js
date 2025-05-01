const path = require("path");
const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");

const logger = require("./logger");
const { FILE_TYPES, MEDIA_DIR } = require("../config/constants");
const getVideoDuration = (filePath) => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      const duration = metadata.format.duration;
      resolve(Math.round(duration));
    });
  });
};

const trimVideo = (inputPath, startTime, duration, outputPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .inputOptions([`-ss ${startTime}`])
      .outputOptions([`-t ${duration}`, "-c copy"])
      .output(outputPath)
      .on("end", () => {
        logger.info(`Video trimmed successfully to ${outputPath}`);
        resolve(outputPath);
      })
      .on("error", (err) => {
        logger.error(`Error trimming video: ${err.message}`);
        reject(err);
      })
      .run();
  });
};

// const addSubtitles = (inputPath, subtitlePath, outputPath) => {
//   return new Promise((resolve, reject) => {
//     ffmpeg(inputPath)
//       .videoFilters(`subtitles=${subtitlePath}`)
//       .outputOptions("-preset", "ultrafast")
//       .output(outputPath)
//       .on("end", () => {
//         logger.info(`Subtitles added successfully to ${outputPath}`);
//         resolve();
//       })
//       .on("error", (err) => {
//         logger.error("Error adding subtitles:", err);
//         reject(err);
//       })
//       .run();
//   });
// };

const addSubtitles = (inputPath, subtitlePath, outputPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        "-vf",
        `subtitles=${subtitlePath}`, // use output filter instead of .videoFilters()
        "-preset",
        "ultrafast", // fastest encoding
        "-c:v",
        "libx264", // force compatible encoding (needed for .mp4)
        "-c:a",
        "copy", // copy audio to save time
      ])
      .output(outputPath)
      .on("end", () => {
        logger.info(`Subtitles added successfully to ${outputPath}`);
        resolve();
      })
      .on("error", (err) => {
        logger.error("Error adding subtitles:", err);
        reject(err);
      })
      .run();
  });
};

const parseTimeToSeconds = (timeStr) => {
  const parts = timeStr.split(":").map(Number);
  return parts[0] * 3600 + parts[1] * 60 + parts[2];
};

const getDirPath = async (type, id = null, timestamp = null) => {
  const baseFolders = {
    upload: "media/uploads",
    unconfirmed: "media/unconfirmed",
  };

  let baseFolder = baseFolders[type];

  if (id) {
    baseFolder = path.join(baseFolder, id.toString());
  }

  if (timestamp) {
    baseFolder = path.join(baseFolder, timestamp.toString());
  }

  const fullPath = path.join(__dirname, "..", baseFolder);

  // Ensure the folder exists
  await fs.promises.mkdir(fullPath, { recursive: true });

  return fullPath;
};

const formatTimeForSRT = (time) => {
  return time.replace(/:/g, ":") + ",000"; // Add ,000 milliseconds
};

const getLatestUnconfirmedFilePath = async (inputPath, videoId, fileName) => {
  const directoryPath = path
    .dirname(inputPath)
    .replace("uploads", "unconfirmed");
  const newPath = path.join(directoryPath, `${videoId}/${fileName}`);
  return newPath;
};

const getFileType = (mimeType) => {
  return FILE_TYPES[mimeType];
};

const getFilePaths = async (video, operation) => {
  const fileName = video.unconfirmed_file_path || video.file_path;
  const inputFolder = video.unconfirmed_file_path
    ? await getDirPath(MEDIA_DIR.UNCONFIRMED, video.id)
    : await getDirPath(MEDIA_DIR.UPLOAD);

  const inputPath = path.join(inputFolder, fileName);

  const outputFolder = await getDirPath(MEDIA_DIR.UNCONFIRMED, video.id);
  const outputFile = `${operation}_${Date.now()}.${video.file_type}`;
  const outputPath = path.join(outputFolder, outputFile);

  return { inputPath, outputPath };
};

const cleanupTempFiles = async (videoId, videoFilePath) => {
  try {
    // Get paths to the directories
    const unconfirmedDirPath = await getDirPath(MEDIA_DIR.UNCONFIRMED, videoId);
    const uploadsDirPath = await getDirPath(MEDIA_DIR.UPLOAD);
    const videoFilePathInUploads = path.join(uploadsDirPath, videoFilePath);
    const videoIdDirPath = path.join(uploadsDirPath, videoId.toString()); // For .srt files

    // Function to clean up a directory (delete all files inside)
    const cleanupDir = (dirPath) => {
      if (fs.existsSync(dirPath)) {
        const files = fs.readdirSync(dirPath);
        files.forEach((file) => {
          const filePath = path.join(dirPath, file);
          fs.unlinkSync(filePath);
          logger.info(`Deleted file: ${filePath}`);
        });
        fs.rmdirSync(dirPath);
        logger.info(`Deleted directory: ${dirPath}`);
      }
    };

    // Clean up unconfirmed video files and the directory
    cleanupDir(unconfirmedDirPath);

    // Clean up the original video file
    if (fs.existsSync(videoFilePathInUploads)) {
      fs.unlinkSync(videoFilePathInUploads);
      logger.info(`Deleted original video file: ${videoFilePathInUploads}`);
    }

    // Clean up .srt files and their directory
    cleanupDir(videoIdDirPath);
  } catch (error) {
    logger.error("Error cleaning up temporary files:", error);
  }
};

module.exports = {
  getVideoDuration,
  trimVideo,
  parseTimeToSeconds,
  addSubtitles,
  getDirPath,
  formatTimeForSRT,
  getLatestUnconfirmedFilePath,
  getFileType,
  getFilePaths,
  cleanupTempFiles,
};
