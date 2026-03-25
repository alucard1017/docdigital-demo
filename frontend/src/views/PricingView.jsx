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

  const [invoices, setInvoices] = useState([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);

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
        api.get("/billing/payment-methods"),
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

      const res = await api.post("/billing/payment-methods/update");
      const data = res.data;

      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
        return;
      }

      setMessage(
        data.message ||
          "Se ha iniciado el proceso para actualizar tu método de pago."
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
      <div
        style={{
          padding: 32,
          minHeight: "100%",
          background: "#020617",
          color: "#e5e7eb",
        }}
      >
        <h2 style={{ marginBottom: 8 }}>Planes y facturación</h2>
        <p style={{ color: "#94a3b8" }}>Cargando información de planes...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          padding: 32,
          minHeight: "100%",
          background: "#020617",
          color: "#e5e7eb",
        }}
      >
        <h2 style={{ marginBottom: 8 }}>Planes y facturación</h2>
        <p style={{ color: "#fecaca", marginBottom: 12 }}>{error}</p>
        <button
          className="btn-main btn-primary"
          onClick={loadData}
          style={{ minWidth: 140 }}
        >
          Reintentar
        </button>
      </div>
    );
  }

  const currentPlanId = subscription?.currentPlanId;

  return (
    <div
      style={{
        padding: 32,
        minHeight: "100%",
        background:
          "radial-gradient(circle at top, #020617 0, #020617 45%, #0b1120 100%)",
        color: "#e5e7eb",
      }}
    >
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
        }}
      >
        <header
          style={{
            marginBottom: 20,
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            alignItems: "flex-start",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h2
              style={{
                marginBottom: 4,
                fontSize: "1.35rem",
                letterSpacing: "0.02em",
              }}
            >
              Planes y facturación
            </h2>
            <p
              style={{
                margin: 0,
                color: "#94a3b8",
                fontSize: "0.95rem",
              }}
            >
              Gestiona el plan de tu empresa, tus métodos de pago y revisa el
              historial de facturación en un solo lugar.
            </p>
          </div>

          {subscription && (
            <div
              style={{
                padding: 10,
                borderRadius: 12,
                border: "1px solid #1d4ed8",
                background:
                  "linear-gradient(135deg, rgba(37,99,235,0.25), rgba(15,23,42,0.9))",
                fontSize: "0.85rem",
                minWidth: 220,
              }}
            >
              <div>
                Plan actual:{" "}
                <span style={{ fontWeight: 600 }}>
                  {subscription.currentPlanId}
                </span>
              </div>
              <div>
                Ciclo de facturación:{" "}
                <span style={{ fontWeight: 600 }}>
                  {subscription.billingPeriod === "yearly"
                    ? "Anual"
                    : "Mensual"}
                </span>
              </div>
              {subscription.renewalDate && (
                <div>
                  Próxima renovación:{" "}
                  <span style={{ fontWeight: 600 }}>
                    {new Date(
                      subscription.renewalDate
                    ).toLocaleDateString("es-CL")}
                  </span>
                </div>
              )}
              {subscription.status && (
                <div>
                  Estado:{" "}
                  <span style={{ fontWeight: 600 }}>
                    {subscription.status === "active"
                      ? "Activa"
                      : subscription.status === "trialing"
                      ? "En período de prueba"
                      : subscription.status === "canceled"
                      ? "Cancelada"
                      : subscription.status}
                  </span>
                </div>
              )}
            </div>
          )}
        </header>

        <div style={{ marginBottom: 24 }}>
          <span
            style={{
              marginRight: 10,
              fontSize: "0.9rem",
              color: "#cbd5f5",
            }}
          >
            Ciclo de facturación:
          </span>
          <button
            type="button"
            className="btn-main"
            style={{
              marginRight: 8,
              borderRadius: 999,
              paddingInline: 14,
              backgroundColor:
                billingPeriod === "monthly" ? "#0f172a" : "#e2e8f0",
              color: billingPeriod === "monthly" ? "#f9fafb" : "#0f172a",
              fontSize: "0.85rem",
            }}
            onClick={() => handlePeriodChange("monthly")}
          >
            Mensual
          </button>
          <button
            type="button"
            className="btn-main"
            style={{
              borderRadius: 999,
              paddingInline: 14,
              backgroundColor:
                billingPeriod === "yearly" ? "#0f172a" : "#e2e8f0",
              color: billingPeriod === "yearly" ? "#f9fafb" : "#0f172a",
              fontSize: "0.85rem",
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
        <section style={{ marginBottom: 32 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 18,
            }}
          >
            {plans.map((plan) => {
              const isCurrent = plan.id === currentPlanId;
              const isChanging = changingPlanId === plan.id;

              const price =
                billingPeriod === "monthly"
                  ? plan.priceMonthly
                  : plan.priceYearly;

              const borderColor = isCurrent ? "#4f46e5" : "#1f2937";

              return (
                <article
                  key={plan.id}
                  style={{
                    borderRadius: 16,
                    border: `1px solid ${borderColor}`,
                    padding: 18,
                    background:
                      "linear-gradient(135deg, rgba(15,23,42,0.98), rgba(30,64,175,0.45))",
                    boxShadow: isCurrent
                      ? "0 24px 70px rgba(79,70,229,0.55)"
                      : "0 18px 50px rgba(15,23,42,0.7)",
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
                    <h3
                      style={{
                        margin: 0,
                        fontSize: "1rem",
                      }}
                    >
                      {plan.name}
                    </h3>
                    {isCurrent && (
                      <span
                        style={{
                          fontSize: "0.75rem",
                          padding: "2px 10px",
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
                    <span
                      style={{
                        fontSize: "1.4rem",
                        fontWeight: 600,
                      }}
                    >
                      {formatPrice(price)}
                    </span>
                    <span
                      style={{
                        fontSize: "0.85rem",
                        color: "#9ca3af",
                      }}
                    >
                      {" "}
                      / {billingPeriod === "monthly" ? "mes" : "año"}
                    </span>
                  </div>

                  <div
                    style={{
                      fontSize: "0.85rem",
                      marginBottom: 8,
                      color: "#cbd5f5",
                    }}
                  >
                    Hasta {plan.maxUsers} usuarios,{" "}
                    {plan.maxDocumentsPerMonth} documentos/mes.
                  </div>

                  <ul
                    style={{
                      fontSize: "0.85rem",
                      color: "#e5e7eb",
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
                    style={{
                      width: "100%",
                      borderRadius: 999,
                    }}
                  >
                    {isCurrent
                      ? "Plan seleccionado"
                      : isChanging
                      ? "Aplicando cambio..."
                      : "Cambiar a este plan"}
                  </button>
                </article>
              );
            })}
          </div>
        </section>

        {/* Métodos de pago + Historial en 2 columnas */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 360px) minmax(0, 1fr)",
            gap: 24,
            alignItems: "flex-start",
          }}
        >
          {/* Métodos de pago */}
          <div>
            <h3 style={{ marginBottom: 8 }}>Métodos de pago</h3>
            <p
              style={{
                marginBottom: 12,
                color: "#9ca3af",
                fontSize: "0.9rem",
              }}
            >
              Administra la tarjeta asociada a tu suscripción y actualiza tus
              datos de facturación.
            </p>

            <div
              style={{
                borderRadius: 12,
                border: "1px solid #1f2937",
                padding: 14,
                background:
                  "linear-gradient(145deg, rgba(15,23,42,0.98), rgba(15,23,42,0.9))",
              }}
            >
              {loadingPaymentMethods ? (
                <p style={{ fontSize: "0.9rem", color: "#94a3b8" }}>
                  Cargando métodos de pago...
                </p>
              ) : paymentMethods.length === 0 ? (
                <p style={{ fontSize: "0.9rem", color: "#9ca3af" }}>
                  Aún no hay métodos de pago registrados. Agrega uno para
                  activar tu suscripción.
                </p>
              ) : (
                <div>
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
                        <div
                          style={{
                            fontSize: "0.8rem",
                            color: "#9ca3af",
                          }}
                        >
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

              <div style={{ marginTop: 10 }}>
                <button
                  type="button"
                  className="btn-main btn-primary"
                  onClick={handleUpdatePaymentMethod}
                  disabled={updatingPaymentMethod}
                  style={{ width: "100%", borderRadius: 999 }}
                >
                  {updatingPaymentMethod
                    ? "Redirigiendo a portal seguro..."
                    : paymentMethods.length > 0
                    ? "Actualizar método de pago"
                    : "Agregar método de pago"}
                </button>
              </div>
            </div>
          </div>

          {/* Historial de facturación */}
          <div>
            <h3 style={{ marginBottom: 8 }}>Historial de facturación</h3>
            <p
              style={{
                marginBottom: 12,
                color: "#9ca3af",
                fontSize: "0.9rem",
              }}
            >
              Revisa tus facturas anteriores y descarga los comprobantes en PDF.
            </p>

            <div
              className="table-wrapper"
              style={{
                borderRadius: 12,
                border: "1px solid #1f2937",
                background:
                  "linear-gradient(180deg, rgba(15,23,42,0.98), rgba(15,23,42,0.98))",
                maxHeight: 320,
                overflow: "auto",
              }}
            >
              {loadingInvoices ? (
                <p
                  style={{
                    padding: 12,
                    fontSize: "0.9rem",
                    color: "#94a3b8",
                  }}
                >
                  Cargando facturas...
                </p>
              ) : invoices.length === 0 ? (
                <p
                  style={{
                    padding: 12,
                    fontSize: "0.9rem",
                    color: "#9ca3af",
                  }}
                >
                  Aún no tienes facturas generadas.
                </p>
              ) : (
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
                        borderBottom: "1px solid #1f2937",
                        background:
                          "linear-gradient(90deg, rgba(15,23,42,1), rgba(30,64,175,0.3))",
                      }}
                    >
                      <th style={{ padding: "8px 8px" }}>Número</th>
                      <th style={{ padding: "8px 8px" }}>Fecha</th>
                      <th style={{ padding: "8px 8px" }}>Monto</th>
                      <th style={{ padding: "8px 8px" }}>Estado</th>
                      <th
                        style={{
                          padding: "8px 8px",
                          textAlign: "right",
                        }}
                      >
                        PDF
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv, idx) => (
                      <tr
                        key={inv.id}
                        style={{
                          borderBottom: "1px solid #020617",
                          background:
                            idx % 2 === 0
                              ? "rgba(15,23,42,1)"
                              : "rgba(15,23,42,0.96)",
                        }}
                      >
                        <td style={{ padding: "8px 8px" }}>{inv.number}</td>
                        <td style={{ padding: "8px 8px" }}>
                          {new Date(inv.date).toLocaleDateString("es-CL")}
                        </td>
                        <td style={{ padding: "8px 8px" }}>
                          {formatCurrency(inv.amount, inv.currency || "CLP")}
                        </td>
                        <td style={{ padding: "8px 8px" }}>
                          {inv.status === "paid"
                            ? "Pagada"
                            : inv.status === "open"
                            ? "Pendiente"
                            : inv.status}
                        </td>
                        <td
                          style={{
                            padding: "8px 8px",
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
                                borderRadius: 999,
                                background: "#1d4ed8",
                                color: "#f9fafb",
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
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default PricingView;