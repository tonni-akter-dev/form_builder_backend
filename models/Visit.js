const mongoose = require('mongoose');

const visitSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  count: { type: Number, default: 0 },
  uniqueVisitors: [{ type: String }] // Store IP addresses
});

// Static method to get or create daily visit record
visitSchema.statics.getDailyVisit = async function(date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  let visit = await this.findOne({
    date: {
      $gte: startOfDay,
      $lte: endOfDay
    }
  });
  
  if (!visit) {
    visit = new this({ date: startOfDay, count: 0, uniqueVisitors: [] });
  }
  
  return visit;
};

module.exports = mongoose.model('Visit', visitSchema);