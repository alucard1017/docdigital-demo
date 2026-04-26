const express = require("express");
const router = express.Router();

const { requireAuth } = require("./auth");
const db = require("../db");

router.get("/help/faqs", requireAuth, async (req, res, next) => {
  try {
    const language = req.query.language === "en" ? "en" : "es";
    const questionField = language === "en" ? "question_en" : "question_es";
    const answerField = language === "en" ? "answer_en" : "answer_es";

    const { rows } = await db.query(`
      SELECT
        id,
        category,
        ${questionField} AS question,
        ${answerField} AS answer,
        sort_order,
        is_active
      FROM faqs
      WHERE is_active = TRUE
      ORDER BY category ASC, sort_order ASC, id ASC
    `);

    res.status(200).json({
      ok: true,
      data: rows,
    });
  } catch (error) {
    next(error);
  }
});

router.post("/help/query", requireAuth, async (req, res, next) => {
  try {
    const { subject, message, source } = req.body;

    const { rows } = await db.query(
      `
        INSERT INTO support_tickets (
          user_id,
          subject,
          message,
          source,
          status,
          priority,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, 'open', 'normal', NOW(), NOW())
        RETURNING *
      `,
      [req.user.id, subject, message, source || "WEB_HELP_WIDGET"]
    );

    res.status(201).json({
      ok: true,
      data: rows[0],
    });
  } catch (error) {
    next(error);
  }
});

router.post("/help/escalations", requireAuth, async (req, res, next) => {
  try {
    const { subject, message, source, priority } = req.body;

    const { rows } = await db.query(
      `
        INSERT INTO support_tickets (
          user_id,
          subject,
          message,
          source,
          status,
          priority,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, 'escalated', $5, NOW(), NOW())
        RETURNING *
      `,
      [
        req.user.id,
        subject,
        message,
        source || "WEB_HELP_ESCALATION",
        priority || "high",
      ]
    );

    res.status(201).json({
      ok: true,
      data: rows[0],
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;