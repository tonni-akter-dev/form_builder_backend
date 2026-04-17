const mongoose = require("mongoose");

const answerSchema = new mongoose.Schema({
  fieldId: { type: mongoose.Schema.Types.ObjectId, required: true },
  fieldLabel: { type: String, required: true },
  value: mongoose.Schema.Types.Mixed,
  isCorrect: { type: Boolean, default: false },
  correctAnswer: mongoose.Schema.Types.Mixed,
  marksAwarded: { type: Number, default: 0 },
  needsManualGrading: { type: Boolean, default: false },
  fileUrls: [{ type: String }], // Array of file URLs from ImgBB
  teacherFeedback: { type: String, default: "" },
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
    enum: ["pass", "fail", "pending"],
    default: "pending",
  },
  timeSpent: { type: Number, default: 0 },
  overallFeedback: { type: String, default: "" }, // Add overall feedback
  ipAddress: String,
  userAgent: String,
  importedFrom: String,
  importedAt: Date,
});
module.exports = mongoose.model("Response", responseSchema);
