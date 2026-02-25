// backend/controllers/documents/create.js
const {
  crypto,
  db,
  sendSigningInvitation,
  sendVisadoInvitation,
  uploadPdfToS3,
  getSignedUrl,
  isValidEmail,
  isValidRun,
  validateLength,
  generarNumeroContratoInterno,
  registrarAuditoria,
  generarCodigoVerificacion,
  aplicarMarcaAguaLocal,
  fs,
} = require('./common');

/* ================================
   GET: Listar documentos del usuario
   ================================ */
async function getUserDocuments(req, res) {
  try {
    const { sort } = req.query;
    let orderByClause = 'title ASC, id ASC';

    if (sort === 'fecha_desc') orderByClause = 'created_at DESC';
    if (sort === 'fecha_asc') orderByClause = 'created_at ASC';
    if (sort === 'numero_asc') orderByClause = 'numero_contrato_interno ASC';
    if (sort === 'numero_desc') orderByClause = 'numero_contrato_interno DESC';

    const result = await db.query(
      `SELECT 
         id, owner_id, title, description, file_path, status,
         destinatario_nombre, destinatario_email, destinatario_movil,
         visador_nombre, visador_email, visador_movil,
         firmante_nombre, firmante_email, firmante_movil, firmante_run,
         empresa_rut, signature_status, requires_visado, reject_reason,
         tipo_tramite, tipo_documento, requiere_firma_notarial, created_at, updated_at,
         numero_contrato_interno
       FROM documents 
       WHERE owner_id = $1 
       ORDER BY ${orderByClause}`,
      [req.user.id]
    );

    const docs = result.rows.map((row) => ({
      ...row,
      requiresVisado: row.requires_visado === true,
      file_url: row.file_path,
    }));

    res.json(docs);
  } catch (err) {
    console.error('❌ Error listando documentos:', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
}

/* ================================
   POST: Crear nuevo documento / trámite
   ================================ */
async function createDocument(req, res) {
  try {
    console.log('DEBUG DOCS >> POST /api/docs recibido');
    console.log('DEBUG BODY >>', {
      title: req.body.title,
      destinatario_email: req.body.destinatario_email,
      firmante_email: req.body.firmante_email,
      visador_email: req.body.visador_email,
      requiresVisado: req.body.requiresVisado,
      tipo_tramite: req.body.tipo_tramite,
      tipo_documento: req.body.tipo_documento,
      requiere_firma_notarial: req.body.requiere_firma_notarial,
      firmante_adicional_email: req.body.firmante_adicional_email,
    });

    const {
      title,
      description,
      destinatario_nombre,
      destinatario_email,
      destinatario_movil,
      visador_nombre,
      visador_email,
      visador_movil,
      firmante_nombre_completo,
      firmante_email,
      firmante_movil,
      firmante_run,
      empresa_rut,
      requiresVisado,
      firmante_adicional_nombre_completo,
      firmante_adicional_email,
      firmante_adicional_movil,
      tipo_tramite,
      tipo_documento,
      requiere_firma_notarial,
    } = req.body;

    const tipoTramiteNormalizado =
      tipo_tramite === 'notaria' ? 'notaria' : 'propio';
    const tipoDocumentoNormalizado =
      tipo_documento === 'contratos' ? 'contratos' : 'poderes';

    const requiereNotaria =
      requiere_firma_notarial === 'true' || requiere_firma_notarial === true;

    if (!req.file) {
      return res.status(400).json({ message: 'El archivo PDF es obligatorio' });
    }

    if (
      !title ||
      !firmante_nombre_completo ||
      !firmante_email ||
      !firmante_run ||
      !destinatario_nombre ||
      !destinatario_email ||
      !empresa_rut
    ) {
      return res.status(400).json({ message: 'Faltan campos obligatorios' });
    }

    if (!isValidEmail(firmante_email)) {
      return res.status(400).json({ message: 'Email del firmante inválido' });
    }

    if (!isValidEmail(destinatario_email)) {
      return res
        .status(400)
        .json({ message: 'Email del destinatario inválido' });
    }

    if (visador_email && !isValidEmail(visador_email)) {
      return res.status(400).json({ message: 'Email del visador inválido' });
    }

    if (firmante_adicional_email && !isValidEmail(firmante_adicional_email)) {
      return res
        .status(400)
        .json({ message: 'Email del firmante adicional inválido' });
    }

    console.log('DEBUG RUN ORIGINAL:', firmante_run, typeof firmante_run);
    const runValue = Array.isArray(firmante_run) ? firmante_run[0] : firmante_run;
    console.log('DEBUG RUN NORMALIZADO:', runValue, typeof runValue);

    if (!isValidRun(runValue)) {
      return res.status(400).json({
        message: 'RUN del firmante inválido (ej: 12.345.678-9)',
      });
    }

    try {
      validateLength(title, 5, 200, 'Título');
      validateLength(firmante_nombre_completo, 3, 100, 'Nombre del firmante');
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }

    let originalKey = null;
    let watermarkedKey = null;

    try {
      originalKey = `documentos/${req.user.id}/original-${Date.now()}-${req.file.originalname}`;
      await uploadPdfToS3(req.file.path, originalKey);
      console.log(`✅ Archivo ORIGINAL subido a S3: ${originalKey}`);

      await aplicarMarcaAguaLocal(req.file.path);

      watermarkedKey = `documentos/${req.user.id}/watermark-${Date.now()}-${req.file.originalname}`;
      await uploadPdfToS3(req.file.path, watermarkedKey);
      console.log(`✅ Archivo CON MARCA subido a S3: ${watermarkedKey}`);
    } catch (s3Error) {
      console.error('⚠️ Error subiendo a S3:', s3Error.message);
      return res
        .status(500)
        .json({ message: 'No se pudo subir el archivo a S3' });
    } finally {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlink(req.file.path, (err) => {
          if (err) {
            console.error('⚠️ Error eliminando archivo temporal:', err);
          }
        });
      }
    }

    const signatureToken = crypto.randomUUID();
    const signatureExpiresAt = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000
    );
    const requires_visado = requiresVisado === 'true';

    const initialStatus = requires_visado
      ? 'PENDIENTE_VISADO'
      : 'PENDIENTE_FIRMA';

    const result = await db.query(
      `INSERT INTO documents (
         owner_id, title, description, file_path, status,
         destinatario_nombre, destinatario_email, destinatario_movil,
         visador_nombre, visador_email, visador_movil,
         firmante_nombre, firmante_email, firmante_movil, firmante_run,
         empresa_rut, requires_visado, signature_token,
         signature_token_expires_at, signature_status,
         tipo_tramite, tipo_documento, estado,
         pdf_original_url, pdf_final_url, requiere_firma_notarial,
         created_at, updated_at
       ) VALUES (
         $1, $2, $3, $4, $5,
         $6, $7, $8,
         $9, $10, $11,
         $12, $13, $14, $15,
         $16, $17, $18, $19,
         $20,
         $21, $22, $23, $24, $25, $26,
         NOW(), NOW()
       )
       RETURNING *`,
      [
        req.user.id,
        title,
        description,
        watermarkedKey,
        initialStatus,
        destinatario_nombre,
        destinatario_email,
        destinatario_movil,
        visador_nombre,
        visador_email,
        visador_movil,
        firmante_nombre_completo,
        firmante_email,
        firmante_movil,
        runValue,
        empresa_rut,
        requires_visado,
        signatureToken,
        signatureExpiresAt,
        'PENDIENTE',
        tipoTramiteNormalizado,
        tipoDocumentoNormalizado,
        'borrador',
        originalKey,
        null,
        requiereNotaria,
      ]
    );

    const doc = result.rows[0];

    const correlativoRes = await db.query(
      `SELECT valor::bigint AS ultimo
       FROM configuraciones
       WHERE clave = 'ultimo_correlativo_contrato'`
    );

    const ultimoCorrelativo =
      correlativoRes.rowCount > 0 ? Number(correlativoRes.rows[0].ultimo) : 0;

    const numeroContratoInterno = generarNumeroContratoInterno(ultimoCorrelativo);

    await db.query(
      `INSERT INTO configuraciones (clave, valor)
       VALUES ('ultimo_correlativo_contrato', $1)
       ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor`,
      [String(ultimoCorrelativo + 1)]
    );

    await db.query(
      `UPDATE documents
       SET numero_contrato_interno = $1
       WHERE id = $2`,
      [numeroContratoInterno, doc.id]
    );

    const codigoVerificacion = generarCodigoVerificacion();
    const categoriaFirma = 'SIMPLE';

    const documentosResult = await db.query(
      `INSERT INTO documentos (
         titulo,
         tipo,
         estado,
         categoria_firma,
         codigo_verificacion,
         creado_por,
         created_at,
         updated_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6, NOW(), NOW()
       )
       RETURNING id, codigo_verificacion, categoria_firma`,
      [
        doc.title,
        tipoTramiteNormalizado || 'propio',
        'BORRADOR',
        categoriaFirma,
        codigoVerificacion,
        req.user.id,
      ]
    );

    const documentoNuevo = documentosResult.rows[0];

    await db.query(
      `UPDATE documents
       SET nuevo_documento_id = $1
       WHERE id = $2`,
      [documentoNuevo.id, doc.id]
    );

    const signerMainToken = crypto.randomUUID();
    await db.query(
      `INSERT INTO document_signers (
         document_id, role, name, email, sign_token
       ) VALUES ($1, 'FIRMANTE', $2, $3, $4)`,
      [doc.id, firmante_nombre_completo, firmante_email, signerMainToken]
    );

    try {
      await db.query(
        `INSERT INTO firmantes (
           documento_id, nombre, email, rut, rol, orden_firma, estado, tipo_firma,
           created_at
         )
         VALUES ($1, $2, $3, $4, 'FIRMANTE', 1, 'PENDIENTE', 'SIMPLE', NOW())`,
        [documentoNuevo.id, firmante_nombre_completo, firmante_email, runValue]
      );
    } catch (firmErr) {
      console.error('⚠️ Error creando firmante en tabla firmantes:', firmErr);
    }

    let signerAdditionalToken = null;
    if (firmante_adicional_email) {
      signerAdditionalToken = crypto.randomUUID();
      await db.query(
        `INSERT INTO document_signers (
           document_id, role, name, email, sign_token
         ) VALUES ($1, 'FIRMANTE', $2, $3, $4)`,
        [
          doc.id,
          firmante_adicional_nombre_completo || 'Firmante adicional',
          firmante_adicional_email,
          signerAdditionalToken,
        ]
      );

      try {
        await db.query(
          `INSERT INTO firmantes (
             documento_id, nombre, email, rut, rol, orden_firma, estado, tipo_firma,
             created_at
           )
           VALUES ($1, $2, $3, NULL, 'FIRMANTE', 2, 'PENDIENTE', 'SIMPLE', NOW())`,
          [
            documentoNuevo.id,
            firmante_adicional_nombre_completo || 'Firmante adicional',
            firmante_adicional_email,
          ]
        );
      } catch (firmErr) {
        console.error('⚠️ Error creando firmante adicional en tabla firmantes:', firmErr);
      }
    }

    if (requires_visado && visador_email) {
      await db.query(
        `INSERT INTO document_participants (document_id, step_order, role, name, email)
         VALUES 
         ($1, 1, 'VISADOR', $2, $3),
         ($1, 2, 'FIRMANTE', $4, $5)`,
        [
          doc.id,
          visador_nombre || 'Visador',
          visador_email,
          firmante_nombre_completo,
          firmante_email,
        ]
      );
    } else {
      await db.query(
        `INSERT INTO document_participants (document_id, step_order, role, name, email)
         VALUES 
         ($1, 2, 'FIRMANTE', $2, $3)`,
        [
          doc.id,
          firmante_nombre_completo,
          firmante_email,
        ]
      );
    }

    await db.query(
      `INSERT INTO document_events (
         document_id, actor, action, details, from_status, to_status,
         tipo_evento, detalle, ip, user_agent
       ) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        doc.id,
        req.user.name || 'Sistema',
        'CREADO',
        `Documento "${title}" creado`,
        null,
        initialStatus,
        'DOCUMENTO_CREADO',
        JSON.stringify({
          titulo: title,
          creadoPor: req.user.id,
          tipo_tramite: tipoTramiteNormalizado,
          tipo_documento: tipoDocumentoNormalizado,
        }),
        req.ip,
        req.headers['user-agent'] || null,
      ]
    );

    const frontBaseUrl =
      process.env.FRONTEND_URL || 'https://docdigital-demo.onrender.com';

    console.log(
      'DEBUG DOC EMAILS >> requires_visado:',
      requires_visado,
      'visador_email:',
      visador_email,
      'destinatario_email:',
      destinatario_email
    );

    const emailPromises = [];

    const publicVerifyUrl = `${frontBaseUrl}/verificar`;
    const verificationCode = documentoNuevo.codigo_verificacion;

    if (firmante_email) {
      const urlFirma = `${frontBaseUrl}/firma-publica?token=${signerMainToken}`;
      console.log('📧 [DOC EMAIL] Invitación firmante:', {
        to: firmante_email,
        url: urlFirma,
      });

      emailPromises.push(
        sendSigningInvitation(
          firmante_email,
          title,
          urlFirma,
          firmante_nombre_completo,
          {
            verificationCode,
            publicVerifyUrl,
          }
        )
      );
    }

    if (firmante_adicional_email && signerAdditionalToken) {
      const urlFirmaAdicional = `${frontBaseUrl}/firma-publica?token=${signerAdditionalToken}`;
      console.log('📧 [DOC EMAIL] Invitación firmante adicional:', {
        to: firmante_adicional_email,
        url: urlFirmaAdicional,
      });

      emailPromises.push(
        sendSigningInvitation(
          firmante_adicional_email,
          title,
          urlFirmaAdicional,
          firmante_adicional_nombre_completo || '',
          {
            verificationCode,
            publicVerifyUrl,
          }
        )
      );
    }

    if (requires_visado && visador_email) {
      const urlVisado = `${frontBaseUrl}/firma-publica?token=${signatureToken}&mode=visado}`;
      console.log('📧 [DOC EMAIL] Invitación visador:', {
        to: visador_email,
        url: urlVisado,
      });

      emailPromises.push(
        sendVisadoInvitation(
          visador_email,
          title,
          urlVisado,
          visador_nombre || ''
        )
      );
    }

    if (destinatario_email && destinatario_email !== firmante_email) {
      console.log('📧 [DOC EMAIL] Notificación informativa destinatario:', {
        to: destinatario_email,
      });

      const { sendDestinationNotification } = require('../../services/emailService');

      emailPromises.push(
        sendDestinationNotification(
          destinatario_email,
          title,
          destinatario_nombre || empresa_rut || 'Empresa',
          verificationCode
        )
      );
    }

    try {
      await Promise.all(emailPromises);
    } catch (emailError) {
      console.error(
        '⚠️ [DOC EMAIL] Algún correo falló al enviar:',
        emailError.message
      );
    }

    return res.status(201).json({
      ...doc,
      requiresVisado: doc.requires_visado === true,
      file_url: doc.file_path,
      documentoId: documentoNuevo.id,
      codigoVerificacion: documentoNuevo.codigo_verificacion,
      categoriaFirma: documentoNuevo.categoria_firma,
      message:
        'Documento creado exitosamente. Correos enviados (o intentados enviar) antes de responder.',
    });
  } catch (err) {
    console.error('❌ Error creando documento:', err);
    return res
      .status(500)
      .json({ message: 'Error interno del servidor' });
  }
}

module.exports = {
  getUserDocuments,
  createDocument,
};
