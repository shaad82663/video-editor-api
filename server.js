const express = require("express");
const dotenv = require("dotenv");
const { sequelize, initModels } = require("./models");
const logger = require("./utils/logger");
const errorHandler = require("./middleware/errorHandler");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Routes
const routes = require("./routes/index");
app.use("/api/v1", routes);

app.use(errorHandler);

const startServer = async () => {
  try {
    await sequelize.authenticate();
    logger.info("Database connected successfully");

    await initModels();
    logger.info("Models synchronized with database");

    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
    });
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
