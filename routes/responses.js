const express = require('express');
const Response = require('../models/Response');
const Form = require('../models/Form');
const auth = require('../middleware/auth');

const router = express.Router();

// Submit a response
router.post('/', async (req, res) => {
  try {
    const { formId, answers } = req.body;
    
    // Verify form exists and is published
    const form = await Form.findById(formId);
    if (!form) {
      return res.status(404).json({ error: 'Form not found' });
    }
    if (!form.isPublished) {
      return res.status(400).json({ error: 'Form is not published' });
    }
    
    // Validate required fields
    const missingFields = form.fields
      .filter(field => field.required)
      .filter(field => !answers.some(answer => 
        answer.fieldId.toString() === field._id.toString() && 
        answer.value !== undefined && 
        answer.value !== ''
      ));
    
    if (missingFields.length > 0) {
      return res.status(400).json({ 
        error: 'Required fields are missing',
        missingFields: missingFields.map(f => f.label)
      });
    }
    
    const response = new Response({
      formId,
      answers,
      submittedBy: req.user ? req.user._id : undefined,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    await response.save();
    res.status(201).json({ message: 'Response submitted successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get responses for a specific form (admin only)
router.get('/:formId', auth, auth.adminOnly, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    
    const responses = await Response.find({ formId: req.params.formId })
      .populate('submittedBy', 'username email')
      .sort({ submittedAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await Response.countDocuments({ formId: req.params.formId });
    
    res.json({
      responses,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Export responses to CSV
router.get('/:formId/export', auth, auth.adminOnly, async (req, res) => {
  try {
    const form = await Form.findById(req.params.formId);
    if (!form) {
      return res.status(404).json({ error: 'Form not found' });
    }
    
    const responses = await Response.find({ formId: req.params.formId })
      .populate('submittedBy', 'username email')
      .sort({ submittedAt: -1 });
    
    // Create CSV headers
    const headers = ['Submitted At', 'Submitted By', ...form.fields.map(f => f.label)];
    
    // Create CSV rows
    const rows = responses.map(response => {
      const row = [
        response.submittedAt.toISOString(),
        response.submittedBy ? response.submittedBy.username : 'Anonymous'
      ];
      
      form.fields.forEach(field => {
        const answer = response.answers.find(a => 
          a.fieldId.toString() === field._id.toString()
        );
        row.push(answer ? (answer.value || '') : '');
      });
      
      return row;
    });
    
    // Convert to CSV
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${form.title}_responses.csv"`);
    res.send(csvContent);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;