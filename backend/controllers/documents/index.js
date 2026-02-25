// backend/controllers/documents/index.js
module.exports = {
  ...require('./create'),
  ...require('./timeline'),
  ...require('./signing'),
  ...require('./reminders'),
  ...require('./report'),
};