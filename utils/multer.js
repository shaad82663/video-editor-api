const multer = require("multer");
const path = require("path");
const { getDirPath } = require("../utils/helper");
const fs = require("fs");
const util = require("util");

const mkdir = util.promisify(fs.mkdir);

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      const finalDir = await getDirPath("upload");

      await mkdir(finalDir, { recursive: true });

      cb(null, finalDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const filename = Date.now() + path.extname(file.originalname);
    cb(null, filename); // Use the generated filename
  },
});

const upload = multer({ storage });

module.exports = upload;
