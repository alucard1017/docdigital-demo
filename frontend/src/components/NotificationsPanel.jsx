// src/components/NotificationsPanel.jsx
import React, { useEffect, useState, useCallback, useMemo } from "react";
import api from "../api/client";

function isAbortLikeError(err) {
  return err?.name === "CanceledError" || err?.code === "ERR_CANCELED";
}

function formatDateTime(value) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("es-CL", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function formatTimeAgo(value) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const now = Date.now();
  const diffMs = now - date.getTime();

  const seconds = Math.round(diffMs / 1000);
  if (seconds < 60) return "hace unos segundos";

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;

  const days = Math.round(hours / 24);
  return `hace ${days} d`;
}

function mapNotificationLabel(item) {
  const type = String(item?.event_type || "").toUpperCase().trim();

  if (type === "PUBLIC_SIGN" || type === "PUBLIC_SIGNED") {
    return "Firma registrada";
  }

  if (type === "DOCUMENT_SIGNED_OWNER") {
    return "Firma del propietario";
  }

  if (type === "PUBLIC_REJECT" || type === "DOCUMENT_REJECTED_OWNER") {
    return "Documento rechazado";
  }

  if (type === "DOCUMENT_VISADO_OWNER" || type === "PUBLIC_VISAR" || type === "PUBLIC_VISADO") {
    return "Visación registrada";
  }

  if (type === "STATUS_CHANGED") {
    const toStatus = String(item?.to_status || "").toUpperCase();
    if (toStatus === "FIRMADO") return "Documento completado";
    if (toStatus === "RECHAZADO") return "Documento cerrado por rechazo";
    return "Cambio de estado";
  }

  return item?.action || "Evento de documento";
}

function NotificationItem({ item }) {
  const title =
    item.document_title && item.document_title !== "Documento sin título"
      ? item.document_title
      : "Documento sin título";

  const numeroInterno = item.numero_interno || null;
  const actor = item.actor || "system";
  const label = mapNotificationLabel(item);

  const createdAt = item.created_at || item.createdAt || null;
  const timeAgo = formatTimeAgo(createdAt);
  const exact = formatDateTime(createdAt);

  return (
    <li className="flex items-start gap-3 border-b border-slate-100 px-1 py-3 last:border-b-0">
      <div className="mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full bg-emerald-500" />

      <div className="flex flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-col">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              {numeroInterno ? (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-mono text-slate-600">
                  {numeroInterno}
                </span>
              ) : null}
              <span className="text-slate-400">·</span>
              <span className="text-[11px] uppercase tracking-wide text-emerald-700">
                {label}
              </span>
            </div>

            <p className="mt-1 line-clamp-1 text-sm font-medium text-slate-900">
              {title}
            </p>
          </div>

          <div className="flex flex-col items-end gap-1 text-right">
            <span className="text-xs text-slate-400" title={exact}>
              {timeAgo}
            </span>
            <span className="text-[11px] text-slate-500">
              {actor !== "system" ? `por ${actor}` : "por sistema"}
            </span>
          </div>
        </div>

        {item.metadata?.motivo ? (
          <p className="mt-1 text-xs text-slate-500">
            Motivo: {item.metadata.motivo}
          </p>
        ) : null}
      </div>
    </li>
  );
}

export function NotificationsPanel({ maxItems = 10 }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const hasItems = useMemo(() => items.length > 0, [items]);

  const loadNotifications = useCallback(
    async (signal, { silent = false } = {}) => {
      try {
        if (silent) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError("");

        const res = await api.get(
          `/docs/notifications?limit=${maxItems}`,
          signal ? { signal } : undefined
        );

        const data = res?.data || {};
        const nextItems = Array.isArray(data.items) ? data.items : [];

        setItems(nextItems);
      } catch (err) {
        if (isAbortLikeError(err)) return;

        console.error("Error cargando notificaciones:", err);
        const msg =
          err?.response?.data?.message ||
          err?.message ||
          "Error al cargar notificaciones";
        setError(msg);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [maxItems]
  );

  useEffect(() => {
    const controller = new AbortController();
    loadNotifications(controller.signal);
    return () => controller.abort();
  }, [loadNotifications]);

  const handleRefresh = useCallback(() => {
    const controller = new AbortController();
    loadNotifications(controller.signal, { silent: true });
  }, [loadNotifications]);

  if (loading) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">
            Actividad reciente
          </h2>
          <div className="h-6 w-16 animate-pulse rounded-full bg-slate-100" />
        </div>
        <div className="space-y-3">
          <div className="h-14 animate-pulse rounded-xl bg-slate-100" />
          <div className="h-14 animate-pulse rounded-xl bg-slate-100" />
          <div className="h-14 animate-pulse rounded-xl bg-slate-100" />
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-2xl border border-rose-200 bg-rose-50 p-5 shadow-sm">
        <div className="mb-2 text-sm font-semibold text-rose-900">
          No pudimos cargar la actividad reciente
        </div>
        <p className="text-xs leading-5 text-rose-700">{error}</p>
        <button
          type="button"
          onClick={handleRefresh}
          className="mt-3 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-700"
        >
          Reintentar
        </button>
      </section>
    );
  }

  if (!hasItems) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-2 text-sm font-semibold text-slate-900">
          Actividad reciente
        </div>
        <p className="text-xs leading-5 text-slate-500">
          Aún no hay eventos de firma, rechazo o visación recientes. Cuando se
          registren, aparecerán aquí para un acceso rápido.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900">
          Actividad reciente
        </h2>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="text-xs font-medium text-slate-500 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {refreshing ? "Actualizando..." : "Actualizar"}
        </button>
      </div>

      <ul className="divide-y divide-slate-100">
        {items.map((item) => (
          <NotificationItem key={item.id} item={item} />
        ))}
      </ul>
    </section>
  );
}

export default NotificationsPanel;