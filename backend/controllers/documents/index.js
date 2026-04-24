// backend/controllers/documents/index.js
const create = require("./create");
const timeline = require("./timeline");
const signing = require("./signing");
const reminders = require("./reminders");
const report = require("./report");
const stats = require("./stats");
const flow = require("./flow");
const publicDocuments = require("./publicDocuments");
const notifications = require("./notifications");

module.exports = {
  ...create,
  ...timeline,
  ...signing,
  ...reminders,
  ...report,
  ...stats,
  ...flow,
  ...publicDocuments,
  ...notifications,
};