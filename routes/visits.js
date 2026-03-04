const express = require('express');
const Visit = require('../models/Visit');
const router = express.Router();

// Get visit statistics
router.get('/stats', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    
    const visits = await Visit.find({
      date: { $gte: startDate }
    }).sort({ date: 1 });
    
    // Calculate total visits and unique visitors
    let totalVisits = 0;
    let totalUniqueVisitors = new Set();
    
    visits.forEach(visit => {
      totalVisits += visit.count;
      visit.uniqueVisitors.forEach(ip => totalUniqueVisitors.add(ip));
    });
    
    // Daily data for chart
    const dailyData = visits.map(visit => ({
      date: visit.date.toISOString().split('T')[0],
      visits: visit.count,
      uniqueVisitors: visit.uniqueVisitors.length
    }));
    
    res.json({
      totalVisits,
      totalUniqueVisitors: totalUniqueVisitors.size,
      dailyData,
      period: `${days} days`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Track a visit
router.post('/track', async (req, res) => {
  try {
    const { ipAddress } = req.body;
    const today = new Date();
    
    let visit = await Visit.getDailyVisit(today);
    
    // Increment visit count
    visit.count += 1;
    
    // Add unique visitor if not already tracked
    if (ipAddress && !visit.uniqueVisitors.includes(ipAddress)) {
      visit.uniqueVisitors.push(ipAddress);
    }
    
    await visit.save();
    
    res.json({ 
      message: 'Visit tracked',
      totalVisits: visit.count,
      uniqueVisitors: visit.uniqueVisitors.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get current visit count
router.get('/', async (req, res) => {
  try {
    const today = new Date();
    const visit = await Visit.getDailyVisit(today);
    
    res.json({ 
      todayVisits: visit.count,
      todayUniqueVisitors: visit.uniqueVisitors.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;