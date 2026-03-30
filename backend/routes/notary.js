// backend/routes/notary.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const { requireAuth } = require("./auth");

const ALLOWED_PROVIDERS = ["LOCAL_PSC_X", "REMOTE_NOTARY", "TEST_PSC"];

function isAnyAdmin(user) {
  return (
    user?.role === "SUPER_ADMIN" ||
    user?.role === "ADMIN_GLOBAL" ||
    user?.role === "ADMIN"
  );
}

/**
 * POST /notary/submit
 * body:
 * {
 *   documentId: number,
 *   provider: "LOCAL_PSC_X" | "REMOTE_NOTARY" | "TEST_PSC",
 *   pdfHash?: string,
 *   externalJobId?: string,
 *   flowType?: "simple" | "advanced" | "notarial",
 *   notaryLevel?: "FES" | "FEA" | "FEQ",
 *   metadata?: object
 * }
 */
router.post("/submit", requireAuth, async (req, res) => {
  const user = req.user;
  const {
    documentId,
    provider,
    pdfHash,
    externalJobId,
    flowType,
    notaryLevel,
    metadata,
  } = req.body || {};

  console.log("[NOTARY SUBMIT] body:", req.body);
  console.log("[NOTARY SUBMIT] user:", user);

  if (!user || !user.company_id) {
    return res.status(401).json({ message: "No autenticado" });
  }

  if (!documentId || !provider) {
    return res.status(400).json({
      message: "documentId y provider son requeridos",
    });
  }

  if (!ALLOWED_PROVIDERS.includes(provider)) {
    return res.status(400).json({
      message: `provider inválido. Usa uno de: ${ALLOWED_PROVIDERS.join(", ")}`,
    });
  }

  const docId = Number(documentId);
  if (Number.isNaN(docId)) {
    return res.status(400).json({ message: "documentId inválido" });
  }

  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");

    // 1) Validar documento y permisos
    const docRes = await client.query(
      `
      SELECT id, company_id, title, status, pdf_final_url, pdf_hash_final
      FROM public.documents
      WHERE id = $1
      `,
      [docId]
    );

    console.log(
      "[NOTARY SUBMIT] docId:",
      docId,
      "rowCount:",
      docRes.rowCount
    );

    if (docRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Documento no encontrado" });
    }

    const documento = docRes.rows[0];
    console.log("[NOTARY SUBMIT] documento:", documento);

    if (!isAnyAdmin(user) && documento.company_id !== user.company_id) {
      await client.query("ROLLBACK");
      return res
        .status(403)
        .json({ message: "No tienes permisos sobre este documento" });
    }

    // Hash efectivo: body o valor final del documento
    const effectivePdfHash = pdfHash || documento.pdf_hash_final || null;

    // 2) Crear notary_job
    const insertJobText = `
      INSERT INTO public.notary_jobs (
        document_id,
        provider,
        external_job_id,
        status,
        pdf_hash,
        last_payload,
        created_at,
        updated_at
      ) VALUES (
        $1, $2, $3, 'submitted', $4, $5, now(), now()
      )
      RETURNING id, status, provider, external_job_id, created_at
    `;

    const payload = {
      requestedByUserId: user.id,
      requestedByEmail: user.email || null,
      companyId: user.company_id,
      pdfHash: effectivePdfHash,
      flowType: flowType || null,
      notaryLevel: notaryLevel || null,
      metadata: metadata || null,
    };

    const jobRes = await client.query(insertJobText, [
      documento.id,
      provider,
      externalJobId || null,
      effectivePdfHash,
      payload,
    ]);

    const job = jobRes.rows[0];
    console.log("[NOTARY SUBMIT] notary_job creado:", job);

    // 3) Insertar audit_log notarial
    const ip =
      (req.headers["x-forwarded-for"] || "")
        .toString()
        .split(",")[0]
        .trim() || req.socket.remoteAddress || null;
    const userAgent = req.headers["user-agent"] || null;

    const auditText = `
      INSERT INTO public.audit_logs (
        documento_id,
        signer_id,
        event_type,
        event_at,
        ip_address,
        user_agent,
        pdf_hash,
        documento_estado,
        signer_status,
        metadata,
        notary_job_id,
        created_at
      ) VALUES (
        $1, NULL, 'notary.submitted', now(), $2, $3, $4, $5, NULL, $6, $7, now()
      );
    `;

    const auditMetadata = {
      provider,
      notaryJobId: job.id,
      externalJobId: job.external_job_id,
      flowType: flowType || null,
      notaryLevel: notaryLevel || null,
      requestedBy: {
        id: user.id,
        email: user.email || null,
      },
      extra: metadata || null,
    };

    await client.query(auditText, [
      documento.id,
      ip,
      userAgent,
      effectivePdfHash,
      documento.status,
      auditMetadata,
      job.id,
    ]);

    await client.query("COMMIT");

    return res.status(201).json({
      message: "Job notarial creado y enviado",
      notaryJob: job,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Error en POST /notary/submit:", err);
    return res
      .status(500)
      .json({ message: "Error interno creando job notarial" });
  } finally {
    client.release();
  }
});

module.exports = router;