const express = require('express');
const Response = require('../models/Response');
const Form = require('../models/Form');
const auth = require('../middleware/auth');
const multer = require('multer');
const xlsx = require('xlsx');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');

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

// Bulk import responses for a specific form
router.post('/:formId', auth, upload.single('file'), async (req, res) => {
  try {
    const { formId } = req.params;
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Get the form to validate fields
    const form = await Form.findById(formId);
    if (!form) {
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: 'Form not found' });
    }

    const file = req.file;
    const ext = path.extname(file.originalname).toLowerCase();
    let data = [];
    
    // Parse file
    if (ext === '.csv') {
      data = await new Promise((resolve, reject) => {
        const results = [];
        fs.createReadStream(file.path)
          .pipe(csv())
          .on('data', (row) => results.push(row))
          .on('end', () => resolve(results))
          .on('error', reject);
      });
    } else if (['.xlsx', '.xls'].includes(ext)) {
      const workbook = xlsx.readFile(file.path);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      data = xlsx.utils.sheet_to_json(sheet);
    }

    // Create a map of field labels to field IDs
    const fieldMap = new Map();
    form.fields.forEach(field => {
      fieldMap.set(field.label.toLowerCase(), field._id);
    });

    // Process each row and create responses
    const responses = [];
    const errors = [];
    const fieldLabels = Object.keys(data[0] || {});

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const answers = [];

      // Map CSV columns to form fields
      for (const [csvColumn, value] of Object.entries(row)) {
        const fieldId = fieldMap.get(csvColumn.toLowerCase());
        
        if (fieldId) {
          answers.push({
            fieldId,
            fieldLabel: csvColumn,
            value: value || null
          });
        }
      }

      // Only create response if we have at least one matching field
      if (answers.length > 0) {
        try {
          const response = new Response({
            formId,
            answers,
            submittedAt: new Date(),
            importedFrom: file.originalname
          });
          await response.save();
          responses.push(response);
        } catch (err) {
          errors.push({
            row: i + 1,
            error: err.message,
            data: row
          });
        }
      } else {
        errors.push({
          row: i + 1,
          error: 'No matching fields found',
          data: row
        });
      }
    }

    // Clean up uploaded file
    fs.unlinkSync(file.path);

    res.json({
      success: true,
      message: `Successfully imported ${responses.length} responses`,
      imported: responses.length,
      failed: errors.length,
      errors: errors.slice(0, 10), // Return first 10 errors
      totalRows: data.length,
      fieldMapping: fieldLabels
    });

  } catch (error) {
    // Clean up file on error
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;