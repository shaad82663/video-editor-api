const express = require("express");
const { param, body, validationResult } = require("express-validator");
const moment = require("moment");

const router = express.Router();
const multer = require("multer");

const { Video } = require("../models");

const logger = require("../utils/logger");
const upload = require("../utils/multer");

const {
  uploadVideo,
  trimVideoController,
  addSubtitlesController,
  renderVideoController,
  downloadVideoController,
} = require("../controllers/index");

router.post(
  "/upload",
  upload.single("file"),
  [
    body().custom((_, { req }) => {
      if (!req.file) {
        throw new Error("No video file uploaded");
      }
      const allowedMimeTypes = ["video/mp4", "video/quicktime"]; // .mp4 and .mov allowed
      if (!allowedMimeTypes.includes(req.file.mimetype)) {
        throw new Error("Invalid video format. Only MP4 and MOV are allowed.");
      }
      return true;
    }),
    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      next();
    },
  ],
  uploadVideo
);

router.post(
  "/:id/trim",
  [
    param("id")
      .exists()
      .withMessage("Video ID is required")
      .isString()
      .withMessage("Video ID should be a string"),
    body("start")
      .exists()
      .withMessage("Start time is required")
      .isString()
      .withMessage("Start time should be a string")
      .custom((value) => {
        if (!moment(value, "HH:mm:ss", true).isValid()) {
          throw new Error("Start time must be in the format HH:mm:ss");
        }
        return true;
      }),
    body("end")
      .exists()
      .withMessage("End time is required")
      .isString()
      .withMessage("End time should be a string")
      .custom((value, { req }) => {
        if (!moment(value, "HH:mm:ss", true).isValid()) {
          throw new Error("End time must be in the format HH:mm:ss");
        }

        // Convert the times to moments
        const startTime = moment(req.body.start, "HH:mm:ss");
        const endTime = moment(value, "HH:mm:ss");

        // Compare the times
        if (endTime.isBefore(startTime)) {
          throw new Error("End time must be greater than start time");
        }
        return true;
      }),
    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      next();
    },
  ],
  trimVideoController
);

router.post(
  "/:id/subtitles",
  [
    param("id")
      .exists()
      .withMessage("Video ID is required")
      .isString()
      .withMessage("Video ID must be a string"),
    body("text")
      .exists()
      .withMessage("Subtitle text is required")
      .isString()
      .withMessage("Subtitle text must be a string"),
    body("start")
      .exists()
      .withMessage("Start time is required")
      .isString()
      .withMessage("Start time must be a string")
      .custom((value) => {
        if (!moment(value, "HH:mm:ss", true).isValid()) {
          throw new Error("Start time must be in the format HH:mm:ss");
        }
        return true;
      }),
    body("end")
      .exists()
      .withMessage("End time is required")
      .isString()
      .withMessage("End time must be a string")
      .custom((value, { req }) => {
        if (!moment(value, "HH:mm:ss", true).isValid()) {
          throw new Error("End time must be in the format HH:mm:ss");
        }

        const startTime = moment(req.body.start, "HH:mm:ss");
        const endTime = moment(value, "HH:mm:ss");

        if (endTime.isBefore(startTime)) {
          throw new Error("End time must be greater than start time");
        }
        return true;
      }),
    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      next();
    },
  ],
  addSubtitlesController
);

router.get(
  "/:id/render",
  [param("id").exists().withMessage("Video ID is required").isString()],
  renderVideoController
);

router.get(
  "/:id/download",
  [param("id").exists().withMessage("Video ID is required").isString()],
  downloadVideoController
);

module.exports = router;
