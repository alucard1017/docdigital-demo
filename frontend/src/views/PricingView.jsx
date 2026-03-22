// frontend/src/views/PricingView.jsx
import { useState, useEffect } from "react";
import axios from "axios";

export default function PricingView() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [billingPeriod, setBillingPeriod] = useState("monthly");

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const res = await axios.get("/api/plans");
      setPlans(res.data);
    } catch (err) {
      console.error("Error cargando planes:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-4">Cargando planes...</div>;

  return (
    <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-100 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4 text-gray-900">
            Planes y Precios
          </h1>
          <p className="text-lg text-gray-600 mb-8">
            Elige el plan perfecto para tu empresa
          </p>

          {/* Toggle de período */}
          <div className="inline-flex bg-white rounded-lg p-1 shadow">
            <button
              onClick={() => setBillingPeriod("monthly")}
              className={`px-6 py-2 rounded-md font-semibold transition ${
                billingPeriod === "monthly"
                  ? "bg-blue-600 text-white"
                  : "text-gray-700"
              }`}
            >
              Mensual
            </button>
            <button
              onClick={() => setBillingPeriod("yearly")}
              className={`px-6 py-2 rounded-md font-semibold transition ${
                billingPeriod === "yearly"
                  ? "bg-blue-600 text-white"
                  : "text-gray-700"
              }`}
            >
              Anual <span className="text-sm">(ahorra 17%)</span>
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((plan) => {
            const price =
              billingPeriod === "yearly"
                ? plan.price_yearly / 12
                : plan.price_monthly;
            const isEnterprise = plan.name === "enterprise";

            return (
              <div
                key={plan.id}
                className={`bg-white rounded-xl shadow-lg overflow-hidden border-2 ${
                  plan.name === "pro"
                    ? "border-blue-500 relative"
                    : "border-gray-200"
                }`}
              >
                {plan.name === "pro" && (
                  <div className="bg-blue-500 text-white text-center py-1 text-sm font-semibold">
                    MÁS POPULAR
                  </div>
                )}

                <div className="p-6">
                  <h3 className="text-2xl font-bold mb-2 text-gray-900">
                    {plan.display_name}
                  </h3>
                  <p className="text-gray-600 text-sm mb-6 h-12">
                    {plan.description}
                  </p>

                  <div className="mb-6">
                    {!isEnterprise ? (
                      <>
                        <div className="text-4xl font-bold text-gray-900">
                          ${price.toFixed(0)}
                          <span className="text-lg font-normal text-gray-500">
                            /mes
                          </span>
                        </div>
                        {billingPeriod === "yearly" && (
                          <div className="text-sm text-gray-500">
                            ${plan.price_yearly}/año
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-2xl font-bold text-gray-900">
                        Personalizado
                      </div>
                    )}
                  </div>

                  <ul className="space-y-3 mb-6 text-sm">
                    {!isEnterprise ? (
                      <>
                        >
                          <span className="text-green-500 mr-2">✓</span>
                          <span>
                            Hasta {plan.max_users} usuarios
                          </span>
                        </li>
                        >
                          <span className="text-green-500 mr-2">✓</span>
                          <span>
                            {plan.max_documents_per_month} documentos/mes
                          </span>
                        </li>
                      </>
                    ) : (
                      <>
                        >
                          <span className="text-green-500 mr-2">✓</span>
                          <span>Usuarios ilimitados</span>
                        </li>
                        >
                          <span className="text-green-500 mr-2">✓</span>
                          <span>Documentos ilimitados</span>
                        </li>
                      </>
                    )}

                    {plan.features?.recordatorios && (
                      >
                        <span className="text-green-500 mr-2">✓</span>
                        <span>Recordatorios automáticos</span>
                      </li>
                    )}
                    {plan.features?.templates && (
                      >
                        <span className="text-green-500 mr-2">✓</span>
                        <span>Plantillas de documentos</span>
                      </li>
                    )}
                    {plan.features?.webhooks && (
                      >
                        <span className="text-green-500 mr-2">✓</span>
                        <span>Webhooks</span>
                      </li>
                    )}
                    {plan.features?.analytics && (
                      >
                        <span className="text-green-500 mr-2">✓</span>
                        <span>Analytics avanzado</span>
                      </li>
                    )}
                    {plan.features?.branding && (
                      >
                        <span className="text-green-500 mr-2">✓</span>
                        <span>Branding personalizado</span>
                      </li>
                    )}
                    {plan.features?.priority_support && (
                      >
                        <span className="text-green-500 mr-2">✓</span>
                        <span>Soporte prioritario</span>
                      </li>
                    )}
                  </ul>

                  <button
                    className={`w-full py-3 rounded-lg font-semibold transition ${
                      plan.name === "pro"
                        ? "bg-blue-600 text-white hover:bg-blue-700"
                        : "bg-gray-100 text-gray-900 hover:bg-gray-200"
                    }`}
                  >
                    {isEnterprise ? "Contactar Ventas" : "Seleccionar Plan"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-12 text-center text-gray-600 text-sm">
          <p>Todos los planes incluyen 14 días de prueba gratis</p>
          <p>¿Tienes dudas? Contáctanos en support@verifirma.cl</p>
        </div>
      </div>
    </div>
  );
}
