// src/components/DocStatusBadge.jsx
import React from "react";

export function DocStatusBadge({ status }) {
  const background =
    status === "PENDIENTE" ? "#fef3c7" :
    status === "VISADO"    ? "#e0f2fe" :
    status === "FIRMADO"   ? "#dcfce7" :
    status === "RECHAZADO" ? "#fee2e2" :
    "#e5e7eb";

  const color =
    status === "PENDIENTE" ? "#92400e" :
    status === "VISADO"    ? "#075985" :
    status === "FIRMADO"   ? "#166534" :
    status === "RECHAZADO" ? "#b91c1c" :
    "#374151";

  return (
    <span
      style={{
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: "0.75rem",
        fontWeight: 600,
        background,
        color
      }}
    >
      {status}
    </span>
  );
}
