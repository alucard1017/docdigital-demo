// src/components/DocumentRow.jsx
import React, { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Eye, Download, FileText, AlertTriangle } from "lucide-react";

import { DOC_STATUS } from "../constants";
import api from "../api/client";
import { useToast } from "../hooks/useToast";
import { getErrorMessage } from "./detailView.helpers";
import {
  getProcedureLabel,
  getPrimaryProcedureLabel,
} from "../utils/documentLabels";

function pickFirstNonEmpty(...values) {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return "";
}

function getContractNumber(doc, fallback) {
  return (
    doc?.numero_contrato_interno ||
    doc?.numero_contrato ||
    doc?.contract_number ||
    doc?.n_contrato ||
    doc?.numerocontratointerno ||
    fallback
  );
}

function formatCreatedAtCompact(createdAt, locale = "es-CO") {
  if (!createdAt) return "-";

  const parsed = new Date(createdAt);
  if (Number.isNaN(parsed.getTime())) return "-";

  const date = parsed.toLocaleDateString(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const time = parsed.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
  });

  return `${date} · ${time}`;
}

export default function DocumentRow({ doc, onOpenDetail }) {
  const { t, i18n } = useTranslation();
  const { addToast } = useToast();

  const locale = useMemo(
    () => (i18n.language?.startsWith("en") ? "en-US" : "es-CO"),
    [i18n.language]
  );

  const statusMetaMap = useMemo(
    () => ({
      PENDIENTE: {
        label: t("documents.status.pending", "Pendiente"),
        tone: "warning",
      },
      PENDIENTE_FIRMA: {
        label: t(
          "documents.status.pendingSignature",
          "Pendiente firma"
        ),
        tone: "warning",
      },
      PENDIENTE_VISADO: {
        label: t("documents.status.pendingVisa", "Pendiente visado"),
        tone: "warning",
      },
      VISADO: {
        label: t("documents.status.visa", "Visado"),
        tone: "teal",
      },
      FIRMADO: {
        label: t("documents.status.signed", "Firmado"),
        tone: "success",
      },
      RECHAZADO: {
        label: t("documents.status.rejected", "Rechazado"),
        tone: "danger",
      },
      BORRADOR: {
        label: t("documents.status.draft", "Borrador"),
        tone: "neutral",
      },
    }),
    [t]
  );

  const tipoLabel = useMemo(
    () =>
      getPrimaryProcedureLabel(doc) ||
      getProcedureLabel(doc) ||
      t("documents.type.default", "Documento"),
    [doc, t]
  );

  const titleDocumento = useMemo(
    () =>
      pickFirstNonEmpty(
        doc?.title,
        doc?.titulo,
        doc?.name,
        t("documents.untitled", "Sin título")
      ),
    [doc, t]
  );

  const numeroContrato = useMemo(
    () =>
      getContractNumber(
        doc,
        t("documents.contractNumberFallback", "Sin número")
      ),
    [doc, t]
  );

  const createdAtLabel = useMemo(
    () => formatCreatedAtCompact(doc?.created_at, locale),
    [doc?.created_at, locale]
  );

  const statusMeta = useMemo(
    () =>
      statusMetaMap[doc?.status] || {
        label: doc?.status || t("documents.status.noStatus", "Sin estado"),
        tone: "neutral",
      },
    [doc?.status, statusMetaMap, t]
  );

  const displayFirmante = useMemo(
    () =>
      pickFirstNonEmpty(
        doc?.firmante_nombre,
        doc?.firmanteName,
        doc?.participant_nombre,
        doc?.participant_name,
        doc?.signer_name,
        doc?.signer
      ),
    [doc]
  );

  const displayEmpresa = useMemo(
    () =>
      pickFirstNonEmpty(
        doc?.destinatario_nombre,
        doc?.empresa_nombre,
        doc?.company_name,
        doc?.razon_social
      ),
    [doc]
  );

  const participantePrincipal =
    displayFirmante ||
    displayEmpresa ||
    t("documents.pendingAssignment", "Pendiente de asignar");

  const participanteSecundario =
    displayFirmante && displayEmpresa ? displayEmpresa : "";

  const fetchPdfUrl = useCallback(async () => {
    if (!doc?.id) {
      throw new Error(
        t("documents.errors.invalidDocument", "Documento inválido")
      );
    }

    const response = await api.get(`/docs/${doc.id}/pdf`);
    const data = response?.data;

    if (!data?.url) {
      throw new Error(
        t("documents.errors.pdfUrl", "No se pudo obtener la URL del PDF")
      );
    }

    return data.url;
  }, [doc?.id, t]);

  const handleOpenDetailRow = useCallback(
    (event) => {
      event?.stopPropagation?.();
      onOpenDetail?.(doc);
    },
    [doc, onOpenDetail]
  );

  const handleViewPdf = useCallback(
    async (event) => {
      event.stopPropagation();

      try {
        const url = await fetchPdfUrl();
        window.open(url, "_blank", "noopener,noreferrer");
      } catch (error) {
        addToast({
          type: "error",
          title: t(
            "documents.toasts.openPdfErrorTitle",
            "No se pudo abrir el PDF"
          ),
          message: getErrorMessage(
            error,
            t(
              "documents.toasts.openPdfErrorMessage",
              "No se pudo abrir el PDF"
            )
          ),
        });
      }
    },
    [fetchPdfUrl, addToast, t]
  );

  const handleDownloadPdf = useCallback(
    async (event) => {
      event.stopPropagation();

      try {
        const url = await fetchPdfUrl();
        const link = document.createElement("a");
        link.href = url;
        link.download = `${titleDocumento}.pdf`;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        addToast({
          type: "success",
          title: t(
            "documents.toasts.downloadStartedTitle",
            "Descarga iniciada"
          ),
          message: t(
            "documents.toasts.downloadStartedMessage",
            'Se inició la descarga de "{{title}}".',
            { title: titleDocumento }
          ),
        });
      } catch (error) {
        addToast({
          type: "error",
          title: t(
            "documents.toasts.downloadErrorTitle",
            "No se pudo descargar el PDF"
          ),
          message: getErrorMessage(
            error,
            t(
              "documents.toasts.downloadErrorMessage",
              "No se pudo descargar el PDF"
            )
          ),
        });
      }
    },
    [fetchPdfUrl, titleDocumento, addToast, t]
  );

  const handleViewRejectReason = useCallback(
    (event) => {
      event.stopPropagation();

      if (!doc?.reject_reason) {
        addToast({
          type: "info",
          title: t(
            "documents.toasts.noRejectReasonTitle",
            "Sin motivo registrado"
          ),
          message: t(
            "documents.toasts.noRejectReasonMessage",
            "Este documento no tiene motivo de rechazo."
          ),
        });
        return;
      }

      addToast({
        type: "warning",
        title: t(
          "documents.toasts.rejectReasonTitle",
          "Motivo de rechazo"
        ),
        message: doc.reject_reason,
      });
    },
    [doc?.reject_reason, addToast, t]
  );

  return (
    <tr
      className="doc-row"
      onClick={handleOpenDetailRow}
      aria-label={t(
        "documents.actions.openDetailOf",
        'Abrir detalle de "{{title}}"',
        { title: titleDocumento }
      )}
    >
      <td className="doc-cell-title doc-cell-title-unified">
        <div className="doc-title-stack">
          <div className="doc-title-contract-row">
            <span
              className={`doc-id-pill${
                numeroContrato ===
                t("documents.contractNumberFallback", "Sin número")
                  ? " is-empty"
                  : ""
              }`}
              title={numeroContrato}
            >
              {numeroContrato}
            </span>
          </div>

          <div className="doc-title-main" title={titleDocumento}>
            {titleDocumento}
          </div>

          <div className="doc-title-meta">
            <span className="doc-date-primary">{createdAtLabel}</span>
          </div>
        </div>
      </td>

      <td className="doc-cell-type">
        <span className="doc-chip-tipo" title={tipoLabel}>
          <FileText size={12} aria-hidden="true" />
          <span>{tipoLabel}</span>
        </span>
      </td>

      <td className="doc-cell-status">
        <div className="doc-status-wrap">
          <span
            className={`doc-status-pill doc-status-pill--${statusMeta.tone}`}
            title={statusMeta.label}
          >
            {statusMeta.label}
          </span>
        </div>
      </td>

      <td className="doc-cell-signer">
        <div className="doc-signer-main">{participantePrincipal}</div>
        {participanteSecundario ? (
          <div className="doc-signer-sub">{participanteSecundario}</div>
        ) : null}
      </td>

      <td
        className="doc-cell-actions doc-cell-actions--tight"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="doc-actions">
          <button
            type="button"
            className="btn-main btn-secondary btn-xs doc-action-btn"
            onClick={handleOpenDetailRow}
            title={t("documents.actions.openDetail", "Abrir detalle")}
            aria-label={t(
              "documents.actions.openDetailOf",
              'Abrir detalle de "{{title}}"',
              { title: titleDocumento }
            )}
          >
            {t("documents.actions.openShort", "Abrir")}
          </button>

          <button
            type="button"
            className="btn-main btn-primary btn-xs doc-action-btn"
            onClick={handleViewPdf}
            title={t("documents.actions.viewPdf", "Ver PDF")}
            aria-label={t(
              "documents.actions.viewPdfOf",
              'Ver PDF de "{{title}}"',
              { title: titleDocumento }
            )}
          >
            <Eye size={12} aria-hidden="true" />
            <span>{t("documents.actions.viewPdfShort", "PDF")}</span>
          </button>

          <button
            type="button"
            className="btn-main btn-ghost btn-xs doc-action-btn"
            onClick={handleDownloadPdf}
            title={t("documents.actions.downloadPdf", "Descargar PDF")}
            aria-label={t(
              "documents.actions.downloadPdfOf",
              'Descargar PDF de "{{title}}"',
              { title: titleDocumento }
            )}
          >
            <Download size={12} aria-hidden="true" />
            <span>{t("documents.actions.downloadShort", "Desc.")}</span>
          </button>

          {doc?.status === DOC_STATUS.RECHAZADO && doc?.reject_reason ? (
            <button
              type="button"
              className="btn-main btn-secondary-danger btn-xs doc-action-btn"
              onClick={handleViewRejectReason}
              title={t("documents.actions.rejectReason", "Ver rechazo")}
              aria-label={t(
                "documents.actions.rejectReasonOf",
                'Ver motivo de rechazo de "{{title}}"',
                { title: titleDocumento }
              )}
            >
              <AlertTriangle size={12} aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </td>
    </tr>
  );
}