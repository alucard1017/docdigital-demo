// src/components/EventList.jsx
import React from "react";

export function EventList({ events }) {
  const safeEvents = Array.isArray(events) ? events : [];

  if (safeEvents.length === 0) {
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
      {safeEvents.map((e) => (
        <li
          key={e.id || `${e.action}-${e.timestamp}`}
          style={{ marginBottom: 6 }}
        >
          {/* ajusta este contenido a tu estructura real */}
          <strong>{e.action}</strong> – {e.details} ({e.actor})
        </li>
      ))}
    </ul>
  );
}
