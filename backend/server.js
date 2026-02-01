require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const https = require('https');

console.log('=====================================');
console.log('🚀 INICIANDO SERVER.JS');
console.log('=====================================');

const app = express();

// ✅ Confiar en proxy de Render
app.set('trust proxy', 1);

/* ================================
   VALIDAR VARIABLES DE ENTORNO
   ================================ */
const requiredEnvVars = [
  'DATABASE_URL',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_REGION',
  'AWS_S3_BUCKET',
  'SMTP_HOST',
  'SMTP_USER',
  'SMTP_PASS'
];

const missingVars = requiredEnvVars.filter(variable => !process.env[variable]);
if (missingVars.length > 0) {
  console.warn('⚠️  Variables de entorno faltantes:', missingVars.join(', '));
}
console.log('✓ Variables de entorno validadas');

/* ================================
   RATE LIMITING
   ================================ */
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Demasiadas solicitudes, intenta después'
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Demasiados intentos de login, intenta después'
});

app.use(generalLimiter);

/* ================================
   MIDDLEWARES
   ================================ */
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:3000'
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    console.warn('❌ Origen no permitido por CORS:', origin);
    return callback(new Error('Origen no permitido por CORS'));
  },
  credentials: true
}));

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ limit: '25mb', extended: true }));

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

console.log('✓ Middlewares CORS configurados');
console.log('✓ Middlewares JSON configurados');
console.log('✓ Directorio de uploads verificado');

/* ================================
   RUTAS DE SALUD / PING
   ================================ */
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    timestamp: new Date().toISOString(),
    s3_enabled: !!process.env.AWS_S3_BUCKET,
    database: process.env.DATABASE_URL ? 'conectada' : 'no configurada'
  });
});
console.log('✓ Ruta GET /api/health registrada');

app.get('/', (req, res) => {
  res.json({
    message: 'API de DocDigital funcionando',
    version: '2.0',
    features: ['autenticación', 'documentos', 'firma digital', 'S3 storage'],
    timestamp: new Date().toISOString()
  });
});
console.log('✓ Ruta GET / registrada');

/* ================================
   RUTAS PRINCIPALES
   ================================ */
const authRoutes = require('./routes/auth');
const docRoutes = require('./routes/documents');
const publicRoutes = require('./routes/public'); // 👈 nuevo router público
const { requireAuth, requireRole } = require('./routes/auth');

app.use('/api/auth', loginLimiter, authRoutes);
console.log('✓ Rutas /api/auth registradas');

app.use('/api/docs', docRoutes);
console.log('✓ Rutas /api/docs registradas');

app.use('/api/public', publicRoutes);
console.log('✓ Rutas /api/public registradas');

/* ================================
   DESCARGA DE DOCUMENTOS (PDF) INTERNA
   ================================ */
/**
 * GET /api/docs/:id/download
 * Descargar PDF del documento (el backend lo trae de S3 y lo envía)
 */
app.get('/api/docs/:id/download', requireAuth, async (req, res) => {
  try {
    const db = require('./db');
    const { getSignedUrl } = require('./services/s3');

    const docId = req.params.id;

    // Verificar que el documento existe y pertenece al usuario
    const docRes = await db.query(
      `SELECT file_path, title FROM documents WHERE id = $1 AND owner_id = $2`,
      [docId, req.user.id]
    );

    if (docRes.rows.length === 0) {
      return res.status(404).json({ message: 'Documento no encontrado' });
    }

    const doc = docRes.rows[0];
    const signedUrl = await getSignedUrl(doc.file_path, 3600);

    // Descargar desde S3 y enviar al navegador
    https.get(signedUrl, (s3Res) => {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${doc.title || 'documento'}.pdf"`);
      s3Res.pipe(res);
    }).on('error', (err) => {
      console.error('❌ Error descargando de S3:', err);
      res.status(500).json({ message: 'Error descargando archivo' });
    });
  } catch (error) {
    console.error('❌ Error en descarga:', error);
    res.status(500).json({ message: 'Error interno' });
  }
});
console.log('✓ Ruta GET /api/docs/:id/download registrada');

/* ================================
   RUTA S3 / URLs FIRMADAS
   ================================ */
app.get('/api/s3/download/:fileKey', requireAuth, async (req, res) => {
  try {
    const { getSignedUrl } = require('./services/s3');
    const db = require('./db');
    const fileKey = req.params.fileKey;

    const docCheck = await db.query(
      `SELECT id FROM documents WHERE file_path LIKE $1 AND owner_id = $2 LIMIT 1`,
      [`%${fileKey}%`, req.user.id]
    );

    if (docCheck.rows.length === 0) {
      return res.status(403).json({ message: 'No tienes acceso a este archivo' });
    }

    const signedUrl = getSignedUrl(fileKey, 3600);
    res.json({ url: signedUrl, expires_in: 3600 });
  } catch (error) {
    console.error('❌ Error generando URL S3:', error);
    res.status(500).json({ error: 'Error al descargar archivo' });
  }
});
console.log('✓ Ruta GET /api/s3/download/:fileKey registrada');

/* ================================
   RUTAS DE PRUEBA / ADMIN
   ================================ */
app.get('/api/admin/ping', requireAuth, requireRole('admin'), (req, res) => {
  return res.json({
    message: 'Solo admin puede ver esto',
    user: req.user,
    timestamp: new Date().toISOString()
  });
});
console.log('✓ Ruta GET /api/admin/ping registrada');

app.get('/api/test-auth', (req, res) => {
  console.log('📍 GET /api/test-auth llamado');
  const header = req.headers.authorization || '';
  const token = header.replace('Bearer ', '');
  res.json({
    token_recibido: token ? 'sí' : 'no',
    token,
    header_completo: header || 'ninguno'
  });
});
console.log('✓ Ruta GET /api/test-auth registrada');

/* ================================
   RECORDATORIOS
   ================================ */
app.post('/api/recordatorios/pendientes', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { sendReminderEmail } = require('./services/sendReminderEmails');
    const db = require('./db');

    const docResult = await db.query(
      `SELECT id, firmante_email, firmante_nombre, title, signature_token_expires_at
       FROM documents 
       WHERE signature_status = 'PENDIENTE' 
       AND created_at > NOW() - INTERVAL '30 days'
       ORDER BY created_at DESC`
    );

    const documentosPendientes = docResult.rows;
    let enviados = 0;
    let errores = 0;

    for (const doc of documentosPendientes) {
      try {
        const ok = await sendReminderEmail({
          signer_email: doc.firmante_email,
          signer_name: doc.firmante_nombre,
          nombre: doc.title,
          estado: 'PENDIENTE'
        });
        if (ok) enviados++;
      } catch (emailError) {
        console.error(`⚠️  Error enviando recordatorio para doc ${doc.id}:`, emailError.message);
        errores++;
      }
    }

    return res.json({
      mensaje: 'Recordatorios procesados',
      total: documentosPendientes.length,
      enviados,
      errores,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error en recordatorios:', error);
    return res.status(500).json({
      error: 'Error en el servidor al enviar recordatorios',
      detalles: error.message
    });
  }
});
console.log('✓ Ruta POST /api/recordatorios/pendientes registrada');

/* ================================
   ESTADÍSTICAS
   ================================ */
app.get('/api/stats', requireAuth, async (req, res) => {
  try {
    const db = require('./db');

    const docsResult = await db.query(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'PENDIENTE' THEN 1 ELSE 0 END) as pendientes,
        SUM(CASE WHEN status = 'VISADO' THEN 1 ELSE 0 END) as visados,
        SUM(CASE WHEN status = 'FIRMADO' THEN 1 ELSE 0 END) as firmados,
        SUM(CASE WHEN status = 'RECHAZADO' THEN 1 ELSE 0 END) as rechazados
       FROM documents 
       WHERE owner_id = $1`,
      [req.user.id]
    );

    const stats = docsResult.rows[0];

    res.json({
      documentos: stats,
      usuario: req.user.email,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error obteniendo stats:', error);
    res.status(500).json({ error: 'Error obteniendo estadísticas' });
  }
});
console.log('✓ Ruta GET /api/stats registrada');

/* ================================
   MIDDLEWARE GLOBAL DE ERRORES
   ================================ */
const errorHandler = require('./middlewares/errorHandler');
app.use(errorHandler);

/* ================================
   RUTA 404
   ================================ */
app.use((req, res) => {
  res.status(404).json({
    error: 'Ruta no encontrada',
    method: req.method,
    path: req.path,
    timestamp: new Date().toISOString()
  });
});
console.log('✓ Middleware 404 registrado');

/* ================================
   INICIAR SERVIDOR
   ================================ */
const PORT = process.env.PORT || 4000;

const server = app.listen(PORT, () => {
  console.log('=====================================');
  console.log(`✅ API ESCUCHANDO EN PUERTO ${PORT}`);
  console.log('=====================================');
  console.log('📋 Rutas disponibles:');
  console.log('   GET  /api/health');
  console.log('   GET  /api/stats');
  console.log('   GET  /api/auth/...');
  console.log('   POST /api/auth/...');
  console.log('   GET  /api/docs');
  console.log('   POST /api/docs');
  console.log('   GET  /api/docs/:id/timeline');
  console.log('   POST /api/docs/:id/firmar');
  console.log('   POST /api/docs/:id/visar');
  console.log('   POST /api/docs/:id/rechazar');
  console.log('   GET  /api/docs/:id/download');
  console.log('   GET  /api/public/docs/:token');
  console.log('   POST /api/public/docs/:token/firmar');
  console.log('   GET  /api/s3/download/:fileKey');
  console.log('   POST /api/recordatorios/pendientes');
  console.log('=====================================');
  console.log(`🌍 Frontend URL: ${process.env.FRONTEND_URL || 'no configurada'}`);
  console.log(`☁️  S3 Bucket: ${process.env.AWS_S3_BUCKET || 'no configurado'}`);
  console.log('=====================================');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

module.exports = app;
