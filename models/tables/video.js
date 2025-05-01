const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

const Video = sequelize.define(
  "Video",
  {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    duration: DataTypes.INTEGER, // in seconds
    size: DataTypes.BIGINT, // in bytes
    file_path: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    unconfirmed_file_path: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    file_type: {
      type: DataTypes.ENUM("mp4", "mov"),
      allowNull: false,
      defaultValue: "mp4",
    },
  },
  {
    tableName: "videos",
    timestamps: true,
  }
);

module.exports = Video;
