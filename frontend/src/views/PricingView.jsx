// src/views/PricingView.jsx
import { useEffect, useState, useCallback } from "react";
import api from "../api/client";

const formatPrice = (value) => {
  if (value === 0) return "Gratis";
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(value);
};

const formatCurrency = (value, currency = "CLP") => {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
};

function PricingView() {
  const [plans, setPlans] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [billingPeriod, setBillingPeriod] = useState("monthly");
  const [loading, setLoading] = useState(true);
  const [changingPlanId, setChangingPlanId] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // Historial de facturación
  const [invoices, setInvoices] = useState([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);

  // Métodos de pago
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [loadingPaymentMethods, setLoadingPaymentMethods] = useState(false);
  const [updatingPaymentMethod, setUpdatingPaymentMethod] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    setMessage("");
    setLoadingInvoices(true);
    setLoadingPaymentMethods(true);

    try {
      const [plansRes, subRes, invoicesRes, pmRes] = await Promise.all([
        api.get("/billing/plans"),
        api.get("/billing/subscription"),
        api.get("/billing/invoices"),
        api.get("/billing/payment-methods"), // ajusta si tu endpoint es otro
      ]);

      setPlans(plansRes.data || []);
      setSubscription(subRes.data || null);
      setInvoices(invoicesRes.data || []);
      setPaymentMethods(pmRes.data || []);

      if (subRes.data?.billingPeriod) {
        setBillingPeriod(subRes.data.billingPeriod);
      }
    } catch (err) {
      console.error("Error cargando billing:", err);
      const msg =
        err.response?.data?.message ||
        err.message ||
        "No se pudo cargar la información de facturación.";
      setError(msg);
    } finally {
      setLoading(false);
      setLoadingInvoices(false);
      setLoadingPaymentMethods(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleChangePlan = async (planId) => {
    if (!subscription) return;

    const currentPlanId = subscription.currentPlanId;
    if (currentPlanId === planId) return;

    const isUpgrade = (() => {
      const order = ["starter", "pro", "enterprise"];
      const currentIndex = order.indexOf(currentPlanId);
      const targetIndex = order.indexOf(planId);
      if (currentIndex === -1 || targetIndex === -1) return null;
      return targetIndex > currentIndex;
    })();

    const changeType = isUpgrade ? "upgrade" : "downgrade";

    const confirmMsg = isUpgrade
      ? "Vas a mejorar tu plan. El cambio puede aplicar de inmediato con prorrateo. ¿Continuar?"
      : "Vas a bajar de plan. El cambio puede aplicarse al final del ciclo actual. ¿Continuar?";

    if (!window.confirm(confirmMsg)) return;

    try {
      setChangingPlanId(planId);
      setError("");
      setMessage("");

      const res = await api.post("/billing/change-plan", {
        targetPlanId: planId,
        billingPeriod,
        changeType,
      });

      const data = res.data;
      setSubscription(data.newSubscription || subscription);
      setMessage(data.message || "El plan se actualizó correctamente.");
    } catch (err) {
      console.error("Error cambiando de plan:", err);
      const msg =
        err.response?.data?.message ||
        err.message ||
        "No se pudo cambiar de plan.";
      setError(msg);
    } finally {
      setChangingPlanId(null);
    }
  };

  const handlePeriodChange = (period) => {
    setBillingPeriod(period);
  };

  const handleUpdatePaymentMethod = async () => {
    try {
      setUpdatingPaymentMethod(true);
      setError("");
      setMessage("");

      // Aquí puedes redirigir a Stripe Checkout / portal de facturación
      const res = await api.post("/billing/payment-methods/update");
      const data = res.data;

      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
        return;
      }

      setMessage(
        data.message || "Se ha iniciado el proceso para actualizar tu método de pago."
      );
    } catch (err) {
      console.error("Error actualizando método de pago:", err);
      const msg =
        err.response?.data?.message ||
        err.message ||
        "No se pudo iniciar la actualización del método de pago.";
      setError(msg);
    } finally {
      setUpdatingPaymentMethod(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 32 }}>
        <h2>Planes y facturación</h2>
        <p>Cargando información de planes...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 32 }}>
        <h2>Planes y facturación</h2>
        <p style={{ color: "#b91c1c", marginBottom: 12 }}>{error}</p>
        <button className="btn-main btn-primary" onClick={loadData}>
          Reintentar
        </button>
      </div>
    );
  }

  const currentPlanId = subscription?.currentPlanId;

  return (
    <div style={{ padding: 32 }}>
      <h2 style={{ marginBottom: 8 }}>Planes y facturación</h2>
      <p style={{ marginBottom: 20, color: "#64748b", fontSize: "0.95rem" }}>
        Gestiona el plan de tu empresa, tus métodos de pago y revisa el historial de facturación.
      </p>

      {/* Resumen de suscripción */}
      {subscription && (
        <div
          style={{
            marginBottom: 20,
            padding: 12,
            borderRadius: 8,
            background: "#eff6ff",
            border: "1px solid #dbeafe",
            fontSize: "0.9rem",
          }}
        >
          <div>
            Plan actual: <strong>{subscription.currentPlanId}</strong>
          </div>
          <div>
            Ciclo de facturación:{" "}
            <strong>
              {subscription.billingPeriod === "yearly" ? "Anual" : "Mensual"}
            </strong>
          </div>
          {subscription.renewalDate && (
            <div>
              Próxima renovación:{" "}
              <strong>
                {new Date(
                  subscription.renewalDate
                ).toLocaleDateString("es-CL")}
              </strong>
            </div>
          )}
          {subscription.status && (
            <div>
              Estado:{" "}
              <strong>
                {subscription.status === "active"
                  ? "Activa"
                  : subscription.status === "trialing"
                  ? "En período de prueba"
                  : subscription.status === "canceled"
                  ? "Cancelada"
                  : subscription.status}
              </strong>
            </div>
          )}
        </div>
      )}

      {/* Selector de ciclo de facturación */}
      <div style={{ marginBottom: 24 }}>
        <span style={{ marginRight: 8, fontSize: "0.9rem" }}>
          Ciclo de facturación:
        </span>
        <button
          type="button"
          className="btn-main"
          style={{
            marginRight: 8,
            backgroundColor:
              billingPeriod === "monthly" ? "#0f172a" : "#e2e8f0",
            color: billingPeriod === "monthly" ? "#f9fafb" : "#0f172a",
          }}
          onClick={() => handlePeriodChange("monthly")}
        >
          Mensual
        </button>
        <button
          type="button"
          className="btn-main"
          style={{
            backgroundColor:
              billingPeriod === "yearly" ? "#0f172a" : "#e2e8f0",
            color: billingPeriod === "yearly" ? "#f9fafb" : "#0f172a",
          }}
          onClick={() => handlePeriodChange("yearly")}
        >
          Anual (ahorra)
        </button>
      </div>

      {message && (
        <div
          style={{
            marginBottom: 16,
            padding: 10,
            borderRadius: 8,
            background: "#ecfdf3",
            border: "1px solid #bbf7d0",
            color: "#166534",
            fontSize: "0.9rem",
          }}
        >
          {message}
        </div>
      )}

      {/* Grid de planes */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 16,
          marginBottom: 32,
        }}
      >
        {plans.map((plan) => {
          const isCurrent = plan.id === currentPlanId;
          const isChanging = changingPlanId === plan.id;

          const price =
            billingPeriod === "monthly"
              ? plan.priceMonthly
              : plan.priceYearly;

          return (
            <div
              key={plan.id}
              style={{
                borderRadius: 12,
                border: isCurrent
                  ? "2px solid #4f46e5"
                  : "1px solid #e2e8f0",
                padding: 16,
                background: "#ffffff",
                boxShadow: "0 10px 30px rgba(15,23,42,0.04)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 8,
                }}
              >
                <h3 style={{ margin: 0 }}>{plan.name}</h3>
                {isCurrent && (
                  <span
                    style={{
                      fontSize: "0.75rem",
                      padding: "2px 8px",
                      borderRadius: 999,
                      background: "#eef2ff",
                      color: "#4f46e5",
                    }}
                  >
                    Plan actual
                  </span>
                )}
              </div>

              <div style={{ marginBottom: 8 }}>
                <span style={{ fontSize: "1.25rem", fontWeight: 600 }}>
                  {formatPrice(price)}
                </span>
                <span style={{ fontSize: "0.85rem", color: "#6b7280" }}>
                  {" "}
                  / {billingPeriod === "monthly" ? "mes" : "año"}
                </span>
              </div>

              <div style={{ fontSize: "0.85rem", marginBottom: 8 }}>
                Hasta {plan.maxUsers} usuarios,{" "}
                {plan.maxDocumentsPerMonth} documentos/mes.
              </div>

              <ul
                style={{
                  fontSize: "0.85rem",
                  color: "#4b5563",
                  paddingLeft: 18,
                  marginBottom: 12,
                }}
              >
                {plan.features?.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>

              <button
                type="button"
                className="btn-main btn-primary"
                disabled={isCurrent || isChanging}
                onClick={() => handleChangePlan(plan.id)}
                style={{ width: "100%" }}
              >
                {isCurrent
                  ? "Plan seleccionado"
                  : isChanging
                  ? "Aplicando cambio..."
                  : "Cambiar a este plan"}
              </button>
            </div>
          );
        })}
      </div>

      {/* Gestión de métodos de pago */}
      <div style={{ marginBottom: 32 }}>
        <h3 style={{ marginBottom: 8 }}>Métodos de pago</h3>
        <p
          style={{
            marginBottom: 12,
            color: "#6b7280",
            fontSize: "0.9rem",
          }}
        >
          Administra la tarjeta asociada a tu suscripción y actualiza tus datos de facturación.
        </p>

        {loadingPaymentMethods ? (
          <p>Cargando métodos de pago...</p>
        ) : paymentMethods.length === 0 ? (
          <p style={{ fontSize: "0.9rem", color: "#9ca3af" }}>
            Aún no hay métodos de pago registrados. Agrega uno para activar tu suscripción.
          </p>
        ) : (
          <div
            style={{
              borderRadius: 8,
              border: "1px solid #e5e7eb",
              padding: 12,
              maxWidth: 420,
            }}
          >
            {paymentMethods.map((pm) => (
              <div
                key={pm.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: "0.9rem",
                  marginBottom: 8,
                }}
              >
                <div>
                  <div>
                    {pm.brand?.toUpperCase() || "Tarjeta"} •••• {pm.last4}
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "#6b7280" }}>
                    Vence {pm.expMonth}/{pm.expYear}
                  </div>
                </div>
                {pm.isDefault && (
                  <span
                    style={{
                      fontSize: "0.75rem",
                      padding: "2px 6px",
                      borderRadius: 999,
                      background: "#ecfdf3",
                      color: "#166534",
                    }}
                  >
                    Principal
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 12 }}>
          <button
            type="button"
            className="btn-main btn-primary"
            onClick={handleUpdatePaymentMethod}
            disabled={updatingPaymentMethod}
          >
            {updatingPaymentMethod
              ? "Redirigiendo a portal seguro..."
              : paymentMethods.length > 0
              ? "Actualizar método de pago"
              : "Agregar método de pago"}
          </button>
        </div>
      </div>

      {/* Historial de facturación */}
      <div>
        <h3 style={{ marginBottom: 8 }}>Historial de facturación</h3>
        <p
          style={{
            marginBottom: 12,
            color: "#6b7280",
            fontSize: "0.9rem",
          }}
        >
          Revisa tus facturas anteriores y descarga los comprobantes en PDF.
        </p>

        {loadingInvoices ? (
          <p>Cargando facturas...</p>
        ) : invoices.length === 0 ? (
          <p style={{ fontSize: "0.9rem", color: "#9ca3af" }}>
            Aún no tienes facturas generadas.
          </p>
        ) : (
          <div className="table-wrapper">
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "0.85rem",
              }}
            >
              <thead>
                <tr
                  style={{
                    textAlign: "left",
                    borderBottom: "1px solid #e5e7eb",
                  }}
                >
                  <th style={{ padding: "8px 4px" }}>Número</th>
                  <th style={{ padding: "8px 4px" }}>Fecha</th>
                  <th style={{ padding: "8px 4px" }}>Monto</th>
                  <th style={{ padding: "8px 4px" }}>Estado</th>
                  <th style={{ padding: "8px 4px", textAlign: "right" }}>
                    PDF
                  </th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr
                    key={inv.id}
                    style={{ borderBottom: "1px solid #f3f4f6" }}
                  >
                    <td style={{ padding: "8px 4px" }}>{inv.number}</td>
                    <td style={{ padding: "8px 4px" }}>
                      {new Date(inv.date).toLocaleDateString("es-CL")}
                    </td>
                    <td style={{ padding: "8px 4px" }}>
                      {formatCurrency(inv.amount, inv.currency || "CLP")}
                    </td>
                    <td style={{ padding: "8px 4px" }}>
                      {inv.status === "paid"
                        ? "Pagada"
                        : inv.status === "open"
                        ? "Pendiente"
                        : inv.status}
                    </td>
                    <td
                      style={{
                        padding: "8px 4px",
                        textAlign: "right",
                      }}
                    >
                      {inv.downloadUrl ? (
                        <a
                          href={inv.downloadUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-main"
                          style={{
                            fontSize: "0.8rem",
                            padding: "4px 10px",
                          }}
                        >
                          Descargar PDF
                        </a>
                      ) : (
                        <span
                          style={{
                            fontSize: "0.8rem",
                            color: "#9ca3af",
                          }}
                        >
                          No disponible
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default PricingView;
