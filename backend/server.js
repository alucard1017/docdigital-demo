require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

console.log('=====================================');
console.log('🚀 INICIANDO SERVER.JS');
console.log('=====================================');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
console.log('✓ Middlewares configurados');

// Rutas principales
const authRoutes = require('./routes/auth');
const docRoutes = require('./routes/documents');
const { requireAuth, requireRole } = require('./routes/auth');

app.use('/api/auth', authRoutes);
console.log('✓ Rutas /api/auth registradas');

app.use('/api/docs', docRoutes);
console.log('✓ Rutas /api/docs registradas');

// Ruta solo admin
app.get('/api/admin/ping', requireAuth, requireRole('admin'), (req, res) => {
  return res.json({
    message: 'Solo admin puede ver esto',
    user: req.user
  });
});
console.log('✓ Ruta /api/admin/ping (solo admin) registrada');

// Ruta de prueba token
app.get('/api/test-auth', (req, res) => {
  console.log('📍 GET /api/test-auth llamado');
  const header = req.headers.authorization || '';
  const token = header.replace('Bearer ', '');
  res.json({
    token_recibido: token ? 'sí' : 'no',
    token,
    header_completo: header
  });
});
console.log('✓ Ruta /api/test-auth registrada');

// Recordatorios (demo)
app.post('/api/recordatorios/pendientes', async (req, res) => {
  try {
    const { sendReminderEmail } = require('./services/sendReminderEmails');

    const documentosPendientes = [
      {
        id: 1,
        signer_email: 'demo1@correo.com',
        nombre: 'Contrato de prueba 1',
        estado: 'PENDIENTE'
      },
      {
        id: 2,
        signer_email: 'demo2@correo.com',
        nombre: 'Contrato de prueba 2',
        estado: 'PENDIENTE'
      }
    ];

    let enviados = 0;
    for (const doc of documentosPendientes) {
      const ok = await sendReminderEmail(doc);
      if (ok) enviados++;
    }

    return res.json({
      mensaje: 'Recordatorios procesados',
      enviados
    });
  } catch (error) {
    console.error('Error en recordatorios:', error);
    return res
      .status(500)
      .json({ error: 'Error en el servidor al enviar recordatorios.' });
  }
});
console.log('✓ Ruta /api/recordatorios/pendientes registrada');

// Ruta raíz
app.get('/', (req, res) => {
  res.send('API de DocDigital funcionando');
});
console.log('✓ Ruta / registrada');

// Middleware global de errores
const errorHandler = require('./middlewares/errorHandler');
app.use(errorHandler);

// Iniciar servidor
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log('=====================================');
  console.log('✅ API ESCUCHANDO EN PUERTO', PORT);
  console.log('=====================================');
});
