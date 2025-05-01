const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");
const Video = require("./video");

const EditOperation = sequelize.define(
  "EditOperation",
  {
    video_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
    },
    operation_type: {
      type: DataTypes.ENUM("trim", "subtitle", "audio", "text", "image"),
      allowNull: false,
    },
    parameters: {
      type: DataTypes.JSONB,
      allowNull: false,
    },
    file_path: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    has_processed: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  },
  {
    tableName: "edit_operations",
    timestamps: true,
    indexes: [
      {
        fields: ["file_path"],
      },
    ],
  }
);

// Relationships
EditOperation.belongsTo(Video, { foreignKey: "video_id", onDelete: "CASCADE" });
Video.hasMany(EditOperation, { foreignKey: "video_id", onDelete: "CASCADE" });

module.exports = EditOperation;
