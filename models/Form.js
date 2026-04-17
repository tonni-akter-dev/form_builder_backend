const mongoose = require("mongoose");

const fieldSchema = new mongoose.Schema({
  label: { type: String, required: true },
  type: {
    type: String,
    required: true,
    enum: ["text", "textarea", "number", "radio", "select", "checkbox", "date", "time", "file_upload", "rating", "image_text"]
  },
  options: [String],
  correctAnswer: mongoose.Schema.Types.Mixed,
  marks: { type: Number, default: 1 },
  required: { type: Boolean, default: true },
  description: String,
  
  // Number field constraints
  min: Number,
  max: Number,
  
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
  
  // Image text specific fields - UPDATED for ImgBB URL
  imageUrl: { type: String },      // Store ImgBB URL instead of base64
  imagePrompt: { type: String },
});

const formSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  className: { type: String, required: true },
  subject: { type: String, required: true },
  duration: Number,
  totalMarks: Number,
  shuffleQuestions: { type: Boolean, default: false },
  shuffleOptions: { type: Boolean, default: false },
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