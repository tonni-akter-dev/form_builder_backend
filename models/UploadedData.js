const mongoose = require('mongoose');

const uploadedDataSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  originalName: { type: String, required: true },
  data: [mongoose.Schema.Types.Mixed],
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  uploadedAt: { type: Date, default: Date.now },
  rowCount: { type: Number, default: 0 },
  columnCount: { type: Number, default: 0 }
});

module.exports = mongoose.model('UploadedData', uploadedDataSchema);