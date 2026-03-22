// backend/controllers/onboardingController.js
const db = require("../db");

// Obtener estado del onboarding
exports.getOnboardingStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const companyId = req.user.company_id;

    const result = await db.query(
      `SELECT *
       FROM user_onboarding
       WHERE user_id = $1 AND company_id = $2`,
      [userId, companyId]
    );

    if (result.rows.length === 0) {
      const newOnboarding = await db.query(
        `INSERT INTO user_onboarding (user_id, company_id, current_step, steps_completed)
         VALUES ($1, $2, 0, '[]'::jsonb)
         RETURNING *`,
        [userId, companyId]
      );

      return res.json(newOnboarding.rows[0]);
    }

    return res.json(result.rows[0]);
  } catch (error) {
    console.error("❌ Error getting onboarding status:", error);
    return res
      .status(500)
      .json({ error: "Error al obtener estado del onboarding" });
  }
};

// Actualizar paso del onboarding
exports.updateOnboardingStep = async (req, res) => {
  try {
    const userId = req.user.id;
    const companyId = req.user.company_id;
    const { step, stepCompleted } = req.body || {};

    const result = await db.query(
      `UPDATE user_onboarding
       SET current_step = $1,
           steps_completed = CASE
             WHEN $2 IS NOT NULL
                  AND NOT (steps_completed @> to_jsonb($2::text))
             THEN steps_completed || to_jsonb($2::text)
             ELSE steps_completed
           END
       WHERE user_id = $3 AND company_id = $4
       RETURNING *`,
      [step, stepCompleted, userId, companyId]
    );

    return res.json(result.rows[0]);
  } catch (error) {
    console.error("❌ Error updating onboarding step:", error);
    return res
      .status(500)
      .json({ error: "Error al actualizar paso del onboarding" });
  }
};

// Completar onboarding
exports.completeOnboarding = async (req, res) => {
  try {
    const userId = req.user.id;
    const companyId = req.user.company_id;

    const result = await db.query(
      `UPDATE user_onboarding
       SET completed = TRUE,
           completed_at = CURRENT_TIMESTAMP
       WHERE user_id = $1 AND company_id = $2
       RETURNING *`,
      [userId, companyId]
    );

    await db.query(
      `UPDATE companies
       SET onboarding_completed = TRUE,
           onboarding_completed_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [companyId]
    );

    return res.json(result.rows[0]);
  } catch (error) {
    console.error("❌ Error completing onboarding:", error);
    return res
      .status(500)
      .json({ error: "Error al completar onboarding" });
  }
};

// Saltar onboarding
exports.skipOnboarding = async (req, res) => {
  try {
    const userId = req.user.id;
    const companyId = req.user.company_id;

    const result = await db.query(
      `UPDATE user_onboarding
       SET skipped = TRUE,
           completed = TRUE,
           completed_at = CURRENT_TIMESTAMP
       WHERE user_id = $1 AND company_id = $2
       RETURNING *`,
      [userId, companyId]
    );

    return res.json(result.rows[0]);
  } catch (error) {
    console.error("❌ Error skipping onboarding:", error);
    return res
      .status(500)
      .json({ error: "Error al saltar onboarding" });
  }
};

// Product Tour - Obtener progreso
exports.getTourProgress = async (req, res) => {
  try {
    const userId = req.user.id;
    const { tourId } = req.params;

    const result = await db.query(
      `SELECT *
       FROM product_tour_progress
       WHERE user_id = $1 AND tour_id = $2`,
      [userId, tourId]
    );

    if (result.rows.length === 0) {
      return res.json({ step: 0, completed: false, dismissed: false });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    console.error("❌ Error getting tour progress:", error);
    return res
      .status(500)
      .json({ error: "Error al obtener progreso del tour" });
  }
};

// Product Tour - Actualizar progreso
exports.updateTourProgress = async (req, res) => {
  try {
    const userId = req.user.id;
    const { tourId } = req.params;
    const { step, completed, dismissed } = req.body || {};

    const result = await db.query(
      `INSERT INTO product_tour_progress (user_id, tour_id, step, completed, dismissed, updated_at)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id, tour_id)
       DO UPDATE SET
         step = COALESCE($3, product_tour_progress.step),
         completed = COALESCE($4, product_tour_progress.completed),
         dismissed = COALESCE($5, product_tour_progress.dismissed),
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [userId, tourId, step, completed, dismissed]
    );

    return res.json(result.rows[0]);
  } catch (error) {
    console.error("❌ Error updating tour progress:", error);
    return res
      .status(500)
      .json({ error: "Error al actualizar progreso del tour" });
  }
};
