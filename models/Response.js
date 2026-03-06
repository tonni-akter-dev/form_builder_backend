const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema({
  fieldId: { type: mongoose.Schema.Types.ObjectId, required: true },
  fieldLabel: { type: String, required: true },
  value: mongoose.Schema.Types.Mixed,
  fileUrl: String // For file uploads
});

const responseSchema = new mongoose.Schema({
  formId: { type: mongoose.Schema.Types.ObjectId, ref: 'Form', required: true },
  answers: [answerSchema],
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  submittedAt: { type: Date, default: Date.now },
  ipAddress: String,
  userAgent: String,
  importedFrom: String, // Track if imported from CSV
  importedAt: Date
});

module.exports = mongoose.model('Response', responseSchema);