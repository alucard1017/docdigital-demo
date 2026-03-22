// backend/controllers/plans/plansController.js
const db = require("../../db");

/**
 * GET /api/plans
 * Obtener todos los planes activos
 */
async function getPlans(req, res) {
  try {
    const result = await db.query(
      `SELECT 
         id,
         name,
         display_name,
         description,
         price_monthly,
         price_yearly,
         max_users,
         max_documents_per_month,
         features
       FROM plans
       WHERE active = true
       ORDER BY price_monthly ASC`
    );

    return res.json(result.rows);
  } catch (err) {
    console.error("❌ Error obteniendo planes:", err);
    return res.status(500).json({ message: "Error obteniendo planes" });
  }
}

/**
 * GET /api/plans/current
 * Obtener plan actual de la empresa del usuario
 */
async function getCurrentPlan(req, res) {
  try {
    const companyId = req.user.company_id;

    if (!companyId) {
      return res.status(400).json({ message: "Usuario sin empresa asignada" });
    }

    const result = await db.query(
      `SELECT 
         s.id as subscription_id,
         s.status,
         s.billing_period,
         s.current_period_start,
         s.current_period_end,
         s.trial_ends_at,
         p.*
       FROM subscriptions s
       JOIN plans p ON p.id = s.plan_id
       WHERE s.company_id = $1`,
      [companyId]
    );

    if (result.rowCount === 0) {
      return res.json({ 
        message: "Sin suscripción activa",
        plan: null 
      });
    }

    return res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ Error obteniendo plan actual:", err);
    return res.status(500).json({ message: "Error obteniendo plan actual" });
  }
}

module.exports = {
  getPlans,
  getCurrentPlan,
};
