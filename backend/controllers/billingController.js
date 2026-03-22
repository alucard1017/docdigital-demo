// backend/controllers/billingController.js

// En producción, estos planes y la info de billing deberían venir de la BD
// o de un proveedor externo (Stripe, MercadoPago, etc.).
const PLANS = [
  {
    id: "starter",
    name: "Starter",
    priceMonthly: 0,
    priceYearly: 0,
    maxUsers: 3,
    maxDocumentsPerMonth: 50,
    features: ["Firmas básicas", "Soporte por email"],
  },
  {
    id: "pro",
    name: "Pro",
    priceMonthly: 29000,
    priceYearly: 290000,
    maxUsers: 10,
    maxDocumentsPerMonth: 500,
    features: ["Recordatorios automáticos", "Firmas avanzadas"],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    priceMonthly: 99000,
    priceYearly: 990000,
    maxUsers: 100,
    maxDocumentsPerMonth: 5000,
    features: ["SLA dedicado", "Soporte prioritario"],
  },
];

/* ==========================
 * PLANES
 * ========================== */

exports.getPlans = async (req, res) => {
  try {
    return res.json(PLANS);
  } catch (err) {
    console.error("Error getPlans:", err);
    return res.status(500).json({ message: "Error al obtener planes" });
  }
};

/* ==========================
 * SUSCRIPCIÓN ACTUAL
 * ========================== */

exports.getSubscription = async (req, res) => {
  try {
    const user = req.user; // asumiendo middleware de auth que setea req.user
    const companyId = user?.company_id;

    // TODO: leer suscripción real desde BD (tabla subscriptions/companies)
    const subscription = {
      currentPlanId: "pro",
      status: "active", // "trialing" | "canceled"
      renewalDate: "2026-04-10T00:00:00.000Z",
      billingPeriod: "monthly", // "yearly"
      companyId, // opcional, por si quieres usarlo en frontend/debug
    };

    return res.json(subscription);
  } catch (err) {
    console.error("Error getSubscription:", err);
    return res.status(500).json({ message: "Error al obtener suscripción" });
  }
};

/* ==========================
 * CAMBIO DE PLAN
 * ========================== */

exports.changePlan = async (req, res) => {
  try {
    const user = req.user;
    const companyId = user?.company_id;

    const { targetPlanId, billingPeriod, changeType } = req.body;

    if (!targetPlanId || !billingPeriod) {
      return res.status(400).json({
        message: "targetPlanId y billingPeriod son obligatorios",
      });
    }

    const targetPlan = PLANS.find((p) => p.id === targetPlanId);
    if (!targetPlan) {
      return res.status(400).json({ message: "Plan destino inválido" });
    }

    // TODO:
    // - Validar permisos (solo admin de empresa / super admin).
    // - Actualizar plan en la BD (tabla companies/subscriptions).
    // - Llamar a Stripe/MercadoPago si aplica.

    // Simulación de nueva suscripción con próxima renovación en 30 días:
    const newSubscription = {
      currentPlanId: targetPlanId,
      status: "active",
      billingPeriod,
      renewalDate: new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000
      ).toISOString(),
      companyId,
    };

    const message =
      changeType === "upgrade"
        ? "Tu plan se ha mejorado correctamente."
        : "Tu plan se ha actualizado. El cambio puede aplicarse al final del ciclo actual.";

    return res.json({
      success: true,
      message,
      newSubscription,
    });
  } catch (err) {
    console.error("Error changePlan:", err);
    return res.status(500).json({ message: "Error al cambiar de plan" });
  }
};

/* ==========================
 * HISTORIAL DE FACTURAS
 * ========================== */

exports.getInvoices = async (req, res) => {
  try {
    const user = req.user;
    const companyId = user?.company_id;

    // TODO: leer invoices reales desde la BD o desde tu proveedor de pagos
    const invoices = [
      {
        id: "inv_1",
        number: "VF-2026-001",
        amount: 29000,
        currency: "CLP",
        date: "2026-03-10T00:00:00.000Z",
        status: "paid",
        downloadUrl: "https://tus3-bucket/verifirma/invoices/VF-2026-001.pdf",
        companyId,
      },
      {
        id: "inv_2",
        number: "VF-2026-002",
        amount: 29000,
        currency: "CLP",
        date: "2026-04-10T00:00:00.000Z",
        status: "open",
        downloadUrl: null,
        companyId,
      },
    ];

    return res.json(invoices);
  } catch (err) {
    console.error("Error getInvoices:", err);
    return res.status(500).json({ message: "Error al obtener facturas" });
  }
};

/* ==========================
 * MÉTODOS DE PAGO
 * ========================== */

// Lista de métodos de pago (ej: tarjetas)
exports.getPaymentMethods = async (req, res) => {
  try {
    const user = req.user;
    const companyId = user?.company_id;

    // TODO: obtener métodos reales desde Stripe/MercadoPago o tu BD
    const paymentMethods = [
      {
        id: "pm_1",
        brand: "visa",
        last4: "4242",
        expMonth: 12,
        expYear: 2028,
        isDefault: true,
        companyId,
      },
      // Puedes añadir otros métodos si quieres simular más
    ];

    return res.json(paymentMethods);
  } catch (err) {
    console.error("Error getPaymentMethods:", err);
    return res
      .status(500)
      .json({ message: "Error al obtener métodos de pago" });
  }
};

// Iniciar flujo de actualización de método de pago
exports.updatePaymentMethod = async (req, res) => {
  try {
    const user = req.user;
    const companyId = user?.company_id;

    // TODO:
    // - Crear una sesión de portal de facturación (Stripe billing portal).
    // - O generar una URL a tu frontend/checkout.
    // Devolvemos una URL de ejemplo para que el frontend pueda redirigir.

    const dummyPortalUrl =
      "https://example.com/portal-de-facturacion?companyId=" + companyId;

    return res.json({
      success: true,
      message:
        "Redirigiendo al portal seguro para actualizar tu método de pago.",
      redirectUrl: dummyPortalUrl,
    });
  } catch (err) {
    console.error("Error updatePaymentMethod:", err);
    return res.status(500).json({
      message: "Error al iniciar la actualización del método de pago",
    });
  }
};
