// src/services/payments.js
import { isNonExpiringUser } from "../utils/billing.js";

export async function ensureSubscriptionForUser(user) {
  // Internos (tú, admins globales, AOEM SAS): nada de cobros
  if (isNonExpiringUser(user)) {
    // Solo marcar plan local PRO y sin expiración real
    // Aquí solo actualizas DB, sin pasarela
    // TODO: ajusta a tu ORM
    /*
    await db.user.update({
      where: { id: user.id },
      data: {
        plan: "PRO",
        plan_expires_at: null,
      },
    });
    */
    return;
  }

  // Aquí irá la lógica real con Stripe / MercadoPago
  // TODO:
  // - Crear cliente en Stripe/MercadoPago si no existe
  // - Crear suscripción al plan PRO
  // - Guardar ids en la tabla users (stripe_customer_id, etc.)
}