const sequelize = require("../config/database");

const Video = require("./tables/video");
const EditOperation = require("./tables/editOperation");
const initModels = async () => {
  await sequelize.sync({ force: false });
};

module.exports = { sequelize, initModels, Video, EditOperation };
