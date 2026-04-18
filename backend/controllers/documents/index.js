const create = require("./create");
const timeline = require("./timeline");
const signing = require("./signing");
const reminders = require("./reminders");
const report = require("./report");
const stats = require("./stats");
const flow = require("./flow");
const publicDocuments = require("./publicDocuments");

module.exports = {
  ...create,
  ...timeline,
  ...signing,
  ...reminders,
  ...report,
  ...stats,
  ...flow,
  ...publicDocuments,
};