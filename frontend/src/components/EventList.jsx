// src/components/EventList.jsx
import React from "react";

export function EventList({ events }) {
  if (!events || events.length === 0) {
    return (
      <p
        style={{
          fontSize: "0.85rem",
          color: "#9ca3af",
        }}
      >
        No hay eventos registrados para este documento.
      </p>
    );
  }

  return (
    <ul
      style={{
        listStyle: "none",
        padding: 0,
        margin: 0,
        fontSize: "0.85rem",
        color: "#4b5563",
      }}
    >
      {events.map((ev) => (
        <li key={ev.id} style={{ marginBottom: 6 }}>
          <strong>{ev.action}</strong>{" "}
          ·{" "}
          {new Date(ev.created_at).toLocaleString("es-CO", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
          {ev.details && ` · ${ev.details}`}
        </li>
      ))}
    </ul>
  );
}
