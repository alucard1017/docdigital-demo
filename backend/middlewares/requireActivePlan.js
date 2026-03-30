// src/middlewares/requireActivePlan.js
import { isNonExpiringUser } from "../utils/billing.js";

export function requireActivePlan(req, res, next) {
  const user = req.user; // lo rellena tu auth

  if (!user) {
    return res.status(401).json({ message: "No autenticado" });
  }

  // SUPER_ADMIN, ADMIN_GLOBAL y AOEM SAS pasan siempre
  if (isNonExpiringUser(user)) {
    return next();
  }

  // El resto: deben tener plan y fecha de expiración
  if (!user.plan || !user.plan_expires_at) {
    return res.status(402).json({ message: "No tienes un plan activo" });
  }

  const now = new Date();
  const expires = new Date(user.plan_expires_at);

  if (expires < now) {
    return res.status(402).json({ message: "Tu plan ha expirado" });
  }

  next();
}