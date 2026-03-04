const mongoose = require("mongoose");

const fieldSchema = new mongoose.Schema({
  label: { type: String, required: true },
  description: { type: String },
  type: {
    type: String,
    enum: [
      "text",
      "textarea",
      "number",
      "date",
      "time",
      "file_upload",
      "radio",
      "select",
      "checkbox",
      "rating",
      "checkbox_grid",
      "multiple_choice_grid",
    ],
    required: true,
  },
  options: [String],
  rows: [String], // For grid types
  columns: [String], // For grid types
  required: { type: Boolean, default: false },
  // Rating specific fields
  ratingStyle: {
    type: String,
    enum: ["star", "number", "emoji"],
    default: "star",
  },
  ratingMin: { type: Number, default: 1 },
  ratingMax: { type: Number, default: 5 },
  ratingLabels: {
    min: String,
    max: String,
    middle: String,
  },
  // Number field constraints
  min: Number,
  max: Number,
});

const formSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  fields: [fieldSchema],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  isPublished: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

formSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model("Form", formSchema);
