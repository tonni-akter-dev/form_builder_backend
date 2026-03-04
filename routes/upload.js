const express = require('express');
const multer = require('multer');
const xlsx = require('xlsx');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const UploadedData = require('../models/UploadedData');
const auth = require('../middleware/auth');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.csv', '.xlsx', '.xls'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Upload and parse file
router.post('/', auth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const file = req.file;
    const ext = path.extname(file.originalname).toLowerCase();
    let data = [];
    
    if (ext === '.csv') {
      // Parse CSV
      data = await new Promise((resolve, reject) => {
        const results = [];
        fs.createReadStream(file.path)
          .pipe(csv())
          .on('data', (row) => results.push(row))
          .on('end', () => resolve(results))
          .on('error', reject);
      });
    } else if (['.xlsx', '.xls'].includes(ext)) {
      // Parse Excel
      const workbook = xlsx.readFile(file.path);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      data = xlsx.utils.sheet_to_json(sheet);
    }
    
    // Save to database
    const uploadedData = new UploadedData({
      filename: file.filename,
      originalName: file.originalname,
      data,
      uploadedBy: req.user._id,
      rowCount: data.length,
      columnCount: data.length > 0 ? Object.keys(data[0]).length : 0
    });
    
    await uploadedData.save();
    
    // Clean up uploaded file
    fs.unlinkSync(file.path);
    
    res.status(201).json({
      message: 'File uploaded successfully',
      data: {
        id: uploadedData._id,
        originalName: file.originalname,
        rowCount: data.length,
        columnCount: uploadedData.columnCount,
        preview: data.slice(0, 5) // Return first 5 rows as preview
      }
    });
  } catch (error) {
    // Clean up file on error
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    res.status(400).json({ error: error.message });
  }
});

// Get uploaded data list
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    
    const uploadedData = await UploadedData.find({ uploadedBy: req.user._id })
      .select('originalName rowCount columnCount uploadedAt')
      .sort({ uploadedAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await UploadedData.countDocuments({ uploadedBy: req.user._id });
    
    res.json({
      data: uploadedData,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get specific uploaded data
router.get('/:id', auth, async (req, res) => {
  try {
    const { page = 1, limit = 100 } = req.query;
    
    const uploadedData = await UploadedData.findOne({ 
      _id: req.params.id, 
      uploadedBy: req.user._id 
    });
    
    if (!uploadedData) {
      return res.status(404).json({ error: 'Data not found' });
    }
    
    // Paginate the data
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedData = uploadedData.data.slice(startIndex, endIndex);
    
    res.json({
      data: paginatedData,
      columns: uploadedData.data.length > 0 ? Object.keys(uploadedData.data[0]) : [],
      totalPages: Math.ceil(uploadedData.data.length / limit),
      currentPage: page,
      total: uploadedData.data.length,
      originalName: uploadedData.originalName
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete uploaded data
router.delete('/:id', auth, async (req, res) => {
  try {
    const result = await UploadedData.findOneAndDelete({ 
      _id: req.params.id, 
      uploadedBy: req.user._id 
    });
    
    if (!result) {
      return res.status(404).json({ error: 'Data not found' });
    }
    
    res.json({ message: 'Data deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;