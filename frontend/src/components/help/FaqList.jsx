// frontend/src/components/help/FaqList.jsx
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import "../../styles/helpPanel.css";

function normalizeFaqItem(item = {}, index = 0) {
  const id =
    item?.id ??
    item?._id ??
    `${item?.question || "faq"}-${index}`;

  return {
    id,
    category:
      typeof item?.category === "string" ? item.category.trim() : "",
    question:
      typeof item?.question === "string" ? item.question.trim() : "",
    answer:
      typeof item?.answer === "string" ? item.answer.trim() : "",
  };
}

export default function FaqList({ items = [], loading = false, error = "" }) {
  const { t } = useTranslation();

  const normalizedItems = useMemo(() => {
    if (!Array.isArray(items)) return [];

    return items
      .map((item, index) => normalizeFaqItem(item, index))
      .filter((item) => item.question && item.answer);
  }, [items]);

  if (loading) {
    return (
      <p className="help-faq__info" role="status" aria-live="polite">
        {t("help.loadingFaqs", "Cargando preguntas frecuentes...")}
      </p>
    );
  }

  if (error) {
    return (
      <p className="help-faq__error" role="alert">
        {error}
      </p>
    );
  }

  if (!normalizedItems.length) {
    return (
      <p className="help-faq__info" role="status">
        {t("help.emptyFaqs", "No hay preguntas frecuentes disponibles.")}
      </p>
    );
  }

  return (
    <ul className="help-faq__list" role="list">
      {normalizedItems.map((item) => (
        <li key={item.id} className="help-faq__card">
          {item.category ? (
            <div className="help-faq__category">{item.category}</div>
          ) : null}

          <div className="help-faq__question">{item.question}</div>
          <div className="help-faq__answer">{item.answer}</div>
        </li>
      ))}
    </ul>
  );
}