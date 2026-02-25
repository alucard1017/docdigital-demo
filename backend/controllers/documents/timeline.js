// backend/controllers/documents/timeline.js
const { db, getSignedUrl } = require('./common');

/* ================================
   GET: URL firmada solo para VER PDF
   ================================ */
async function getDocumentPdf(req, res) {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT file_path, pdf_original_url, pdf_final_url, estado, status
       FROM documents
       WHERE id = $1`,
      [id]
    );

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ message: 'Documento no encontrado' });
    }

    const {
      file_path,
      pdf_original_url,
      pdf_final_url,
      estado,
      status,
    } = result.rows[0];

    if (!file_path && !pdf_original_url) {
      return res
        .status(404)
        .json({ message: 'Documento sin archivo asociado' });
    }

    if (status === 'FIRMADO' && pdf_final_url) {
      const signedUrlFinal = await getSignedUrl(pdf_final_url, 3600);
      return res.json({ url: signedUrlFinal, final: true });
    }

    const key = pdf_original_url || file_path;
    const signedUrl = await getSignedUrl(key, 3600);

    return res.json({
      url: signedUrl,
      final: false,
    });
  } catch (err) {
    console.error('❌ Error obteniendo PDF:', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
}

/* ================================
   GET: Timeline del documento
   ================================ */
async function getTimeline(req, res) {
  try {
    const docId = req.params.id;

    const docRes = await db.query(
      `SELECT 
         id, title, status, destinatario_nombre,
         empresa_rut, created_at, updated_at,
         requires_visado, firmante_nombre, visador_nombre,
         numero_contrato_interno,
         tipo_tramite, tipo_documento
      FROM documents 
      WHERE id = $1`,
      [docId]
    );

    if (docRes.rows.length === 0) {
      return res
        .status(404)
        .json({ message: 'Documento no encontrado' });
    }

    const doc = docRes.rows[0];

    const eventsRes = await db.query(
      `SELECT 
         id, action, details, actor, from_status, to_status, created_at 
       FROM document_events 
       WHERE document_id = $1 
       ORDER BY created_at ASC`,
      [docId]
    );

    const events = eventsRes.rows;

    let currentStep = 'Pendiente';
    let nextStep = '';
    let progress = 0;

    if (doc.status === 'PENDIENTE_VISADO') {
      currentStep = 'Pendiente de visado';
      nextStep = '⏳ Esperando visación';
      progress = 25;
    } else if (doc.status === 'PENDIENTE_FIRMA') {
      currentStep = 'Pendiente de firma';
      nextStep = '⏳ Esperando firma';
      progress = doc.requires_visado ? 75 : 50;
    } else if (doc.status === 'FIRMADO') {
      currentStep = 'Firmado';
      nextStep = '✅ Completado';
      progress = 100;
    } else if (doc.status === 'RECHAZADO') {
      currentStep = 'Rechazado';
      nextStep = '❌ Rechazado';
      progress = 0;
    }

    const formattedEvents = events.map((evt) => ({
      id: evt.id,
      action: evt.action,
      details: evt.details,
      actor: evt.actor,
      timestamp: evt.created_at,
      fromStatus: evt.from_status,
      toStatus: evt.to_status,
    }));

    return res.json({
      document: {
        id: doc.id,
        title: doc.title,
        status: doc.status,
        destinatario_nombre: doc.destinatario_nombre,
        empresa_rut: doc.empresa_rut,
        created_at: doc.created_at,
        updated_at: doc.updated_at,
        requires_visado: doc.requires_visado,
        numero_contrato_interno: doc.numero_contrato_interno,
        tipo_tramite: doc.tipo_tramite,
        tipo_documento: doc.tipo_documento,
      },
      timeline: {
        currentStep,
        nextStep,
        progress,
        events: formattedEvents,
      },
    });
  } catch (err) {
    console.error('❌ Error obteniendo timeline:', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
}

/* ================================
   GET: Firmantes de un documento
   ================================ */
async function getSigners(req, res) {
  try {
    const { id } = req.params;

    const docRes = await db.query(
      `SELECT id FROM documents WHERE id = $1 AND owner_id = $2`,
      [id, req.user.id]
    );
    if (docRes.rowCount === 0) {
      return res.status(404).json({ message: 'Documento no encontrado' });
    }

    const signersRes = await db.query(
      `SELECT id, name, email, status
       FROM document_signers
       WHERE document_id = $1
       ORDER BY id ASC`,
      [id]
    );

    return res.json(signersRes.rows);
  } catch (err) {
    console.error('❌ Error obteniendo firmantes:', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
}

module.exports = {
  getDocumentPdf,
  getTimeline,
  getSigners,
};
