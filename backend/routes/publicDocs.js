// backend/routes/publicDocs.js
const express = require("express");
const db = require("../db");

const router = express.Router();

/**
 * GET /public/docs/:token
 * Resuelve un link de invitación de firma y devuelve documento + signer.
 */
router.get("/docs/:token", async (req, res) => {
  const { token } = req.params;

  if (!token || typeof token !== "string") {
    return res.status(400).json({ message: "Token inválido" });
  }

  const client = await db.connect();
  try {
    await client.query("BEGIN");

    // 1) Buscar invitation + signer + documento
    const result = await client.query(
      `
      SELECT
        si.id              AS invitation_id,
        si.token           AS invitation_token,
        si.expires_at      AS invitation_expires_at,
        si.sent_at         AS invitation_sent_at,
        s.id               AS signer_id,
        s.full_name        AS signer_full_name,
        s.email            AS signer_email,
        s.role             AS signer_role,
        s.status           AS signer_status,
        s.order_index      AS signer_order_index,
        d.id               AS documento_id,
        d.titulo           AS documento_titulo,
        d.estado           AS documento_estado,
        d.tipo_flujo       AS documento_tipo_flujo,
        d.categoria_firma  AS documento_categoria_firma,
        d.pdf_url          AS documento_pdf_url,       -- si tienes campo, si no ajusta
        d.fecha_expiracion AS documento_fecha_expiracion
      FROM public.signer_invitations si
      JOIN public.signers s
        ON s.id = si.signer_id
      JOIN public.documentos d
        ON d.id = s.documento_id
      WHERE si.token = $1
      LIMIT 1;
      `,
      [token]
    );

    if (result.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Invitación no encontrada" });
    }

    const row = result.rows[0];

    // 2) Validar expiración de la invitación
    if (row.invitation_expires_at && new Date(row.invitation_expires_at) < new Date()) {
      await client.query("ROLLBACK");
      return res.status(410).json({ message: "Esta invitación ha expirado" });
    }

    // 3) Si el signer estaba en "invited", lo pasamos a "opened"
    if (row.signer_status === "invited") {
      await client.query(
        `
        UPDATE public.signers
        SET status = 'opened', updated_at = now()
        WHERE id = $1
        `,
        [row.signer_id]
      );

      // Audit log de apertura
      const ip =
        (req.headers["x-forwarded-for"] || "")
          .toString()
          .split(",")[0]
          .trim() || req.socket.remoteAddress || null;
      const userAgent = req.headers["user-agent"] || null;

      await client.query(
        `
        INSERT INTO public.audit_logs (
          documento_id,
          signer_id,
          event_type,
          event_at,
          ip_address,
          user_agent,
          documento_estado,
          signer_status,
          metadata,
          created_at
        ) VALUES (
          $1, $2, 'invite_opened', now(), $3, $4, $5, $6, $7, now()
        );
        `,
        [
          row.documento_id,
          row.signer_id,
          ip,
          userAgent,
          row.documento_estado,
          "opened",
          { token },
        ]
      );
    }

    await client.query("COMMIT");

    return res.json({
      document: {
        id: row.documento_id,
        titulo: row.documento_titulo,
        estado: row.documento_estado,
        tipoFlujo: row.documento_tipo_flujo,
        categoriaFirma: row.documento_categoria_firma,
        pdfUrl: row.documento_pdf_url || null,
        expiresAt: row.documento_fecha_expiracion,
      },
      signer: {
        id: row.signer_id,
        fullName: row.signer_full_name,
        email: row.signer_email,
        role: row.signer_role,
        status: row.signer_status === "invited" ? "opened" : row.signer_status,
        orderIndex: row.signer_order_index,
      },
      invitation: {
        id: row.invitation_id,
        token: row.invitation_token,
        expiresAt: row.invitation_expires_at,
        sentAt: row.invitation_sent_at,
      },
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Error en GET /public/docs/:token:", err);
    return res.status(500).json({ message: "Error interno" });
  } finally {
    client.release();
  }
});

module.exports = router;