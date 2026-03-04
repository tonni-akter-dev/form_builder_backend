const express = require('express');
const Form = require('../models/Form');
const Response = require('../models/Response');
const auth = require('../middleware/auth');

const router = express.Router();

// Create a new form (admin only)
router.post('/', auth, auth.adminOnly, async (req, res) => {
  try {
    const form = new Form({
      ...req.body,
      createdBy: req.user._id
    });
    await form.save();
    await form.populate('createdBy', 'username email');
    res.status(201).json(form);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get all forms (summary)
router.get('/', auth, async (req, res) => {
  try {
    const forms = await Form.find()
      .select('title description createdAt isPublished createdBy')
      .populate('createdBy', 'username')
      .sort({ createdAt: -1 });
    res.json(forms);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get a single form by ID
router.get('/:id', async (req, res) => {
  try {
    const form = await Form.findById(req.params.id)
      .populate('createdBy', 'username');
    if (!form) return res.status(404).json({ error: 'Form not found' });
    res.json(form);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update a form (admin only)
router.put('/:id', auth, auth.adminOnly, async (req, res) => {
  try {
    const form = await Form.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: new Date() },
      { new: true, runValidators: true }
    ).populate('createdBy', 'username email');
    
    if (!form) return res.status(404).json({ error: 'Form not found' });
    res.json(form);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete a form (admin only)
router.delete('/:id', auth, auth.adminOnly, async (req, res) => {
  try {
    const form = await Form.findByIdAndDelete(req.params.id);
    if (!form) return res.status(404).json({ error: 'Form not found' });
    
    // Also delete all responses for this form
    await Response.deleteMany({ formId: req.params.id });
    
    res.json({ message: 'Form deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get form analytics
router.get('/:id/analytics', auth, auth.adminOnly, async (req, res) => {
  try {
    const responses = await Response.find({ formId: req.params.id });
    const totalResponses = responses.length;
    
    // Group responses by date
    const responsesByDate = responses.reduce((acc, response) => {
      const date = response.submittedAt.toISOString().split('T')[0];
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {});
    
    // Calculate field statistics
    const fieldStats = {};
    if (responses.length > 0) {
      const form = await Form.findById(req.params.id);
      form.fields.forEach(field => {
        const fieldResponses = responses.map(r => 
          r.answers.find(a => a.fieldId.toString() === field._id.toString())
        ).filter(Boolean);
        
        fieldStats[field._id] = {
          label: field.label,
          type: field.type,
          responseCount: fieldResponses.length,
          // Add more statistics based on field type
        };
      });
    }
    
    res.json({
      totalResponses,
      responsesByDate,
      fieldStats
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;