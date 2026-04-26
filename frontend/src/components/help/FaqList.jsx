// frontend/src/components/help/FaqList.jsx
import { useTranslation } from "react-i18next";

export default function FaqList({ items = [], loading = false, error = "" }) {
  const { t } = useTranslation();

  if (loading) {
    return (
      <p style={styles.infoText}>
        {t("help.loadingFaqs", "Cargando preguntas frecuentes...")}
      </p>
    );
  }

  if (error) {
    return <p style={styles.errorText}>{error}</p>;
  }

  if (!items.length) {
    return (
      <p style={styles.infoText}>
        {t("help.emptyFaqs", "No hay preguntas frecuentes disponibles.")}
      </p>
    );
  }

  return (
    <div style={styles.list}>
      {items.map((item) => (
        <article key={item.id} style={styles.card}>
          {item.category ? (
            <div style={styles.category}>{item.category}</div>
          ) : null}
          <div style={styles.question}>{item.question}</div>
          <div style={styles.answer}>{item.answer}</div>
        </article>
      ))}
    </div>
  );
}

const styles = {
  list: {
    display: "grid",
    gap: "12px",
  },
  card: {
    padding: "12px",
    border: "1px solid #e5e7eb",
    borderRadius: "12px",
    background: "#ffffff",
  },
  category: {
    fontSize: "12px",
    fontWeight: 700,
    color: "#0f766e",
    textTransform: "uppercase",
    marginBottom: "6px",
  },
  question: {
    fontSize: "14px",
    fontWeight: 700,
    marginBottom: "6px",
    color: "#111827",
  },
  answer: {
    fontSize: "14px",
    color: "#374151",
    lineHeight: 1.5,
  },
  infoText: {
    margin: 0,
    fontSize: "14px",
    color: "#4b5563",
  },
  errorText: {
    margin: 0,
    fontSize: "14px",
    color: "#b91c1c",
  },
};