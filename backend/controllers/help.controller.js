// backend/controllers/help.controller.js

const helpService = require('../services/help.service');
const { buildSuccess } = require('../utils/responseBuilder');

async function getFaqs(req, res, next) {
  try {
    const { language = 'es' } = req.query;
    const faqs = await helpService.getActiveFaqs(language);
    return buildSuccess(res, faqs);
  } catch (err) {
    next(err);
  }
}

async function createQuery(req, res, next) {
  try {
    const userId = req.user.id;
    const { subject, message, source } = req.body;
    const ticket = await helpService.createTicket({
      userId,
      subject,
      message,
      source: source || 'WEB_HELP_WIDGET',
      priority: 'normal',
    });
    return buildSuccess(res, ticket, 201);
  } catch (err) {
    next(err);
  }
}

async function createEscalation(req, res, next) {
  try {
    const userId = req.user.id;
    const { subject, message, source, priority } = req.body;
    const ticket = await helpService.createTicket({
      userId,
      subject,
      message,
      source: source || 'WEB_HELP_ESCALATION',
      priority: priority || 'high',
      escalated: true,
    });
    return buildSuccess(res, ticket, 201);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getFaqs,
  createQuery,
  createEscalation,
};