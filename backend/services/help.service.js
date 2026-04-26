// backend/services/help.service.js

const db = require('../db');
const AppError = require('../utils/AppError');
const ERROR_CODES = require('../constants/errorCodes');

async function getActiveFaqs(language = 'es') {
  const questionField = language === 'en' ? 'question_en' : 'question_es';
  const answerField = language === 'en' ? 'answer_en' : 'answer_es';

  const { rows } = await db.query(
    `
      SELECT id, category, ${questionField} AS question, ${answerField} AS answer, sort_order
      FROM faqs
      WHERE is_active = TRUE
      ORDER BY category ASC, sort_order ASC, id ASC
    `
  );

  return rows;
}

async function createTicket({ userId, subject, message, source, priority = 'normal', escalated = false }) {
  if (!subject || !message) {
    throw AppError.validation('Subject and message are required', {
      fields: ['subject', 'message'],
    });
  }

  const { rows } = await db.query(
    `
      INSERT INTO support_tickets (user_id, subject, message, source, status, priority)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, user_id, subject, message, source, status, priority, created_at, updated_at
    `,
    [userId, subject, message, source, escalated ? 'escalated' : 'open', priority]
  );

  if (!rows[0]) {
    throw new AppError({
      message: 'Could not create ticket',
      statusCode: 500,
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
    });
  }

  // Aquí luego puedes enchufar notificación a soporte, email, etc.
  return rows[0];
}

module.exports = {
  getActiveFaqs,
  createTicket,
};