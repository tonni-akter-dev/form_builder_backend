const mongoose = require("mongoose");

const answerSchema = new mongoose.Schema({
  fieldId: { type: mongoose.Schema.Types.ObjectId, required: true },
  fieldLabel: { type: String, required: true },
  value: mongoose.Schema.Types.Mixed,
  isCorrect: Boolean,
  correctAnswer: mongoose.Schema.Types.Mixed,
  marksAwarded: { type: Number, default: 0 },

  fileUrl: String,
});

const responseSchema = new mongoose.Schema({
  formId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Form",
    required: true,
  },
  className: String,
  subject: String,
  answers: [answerSchema],
  submittedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  submittedAt: { type: Date, default: Date.now },
  totalMarks: { type: Number, default: 0 },
  obtainedMarks: { type: Number, default: 0 },
  percentage: { type: Number, default: 0 },
  resultStatus: {
    type: String,
    enum: ["pass", "fail"],
  },
  ipAddress: String,
  userAgent: String,
  importedFrom: String,
  importedAt: Date,
});

module.exports = mongoose.model("Response", responseSchema);