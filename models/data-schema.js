

const mongoose = require('mongoose');

const intelligentDataSchema = new mongoose.Schema({
  json: Object,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('analytical_report', intelligentDataSchema);