const logger = require("../utils/logger");

const errorHandler = (err, req, res, next) => {
  logger.error(err.message);
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    message: err.message || "Internal Server Error",
    stack: process.env.NODE_ENV === "development" ? err.stack : null,
  });
};

module.exports = errorHandler;
