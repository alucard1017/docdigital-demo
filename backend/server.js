require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const docRoutes = require('./routes/documents');
const signersRouter = require('./routes/signers');
const { sendReminderEmail } = require('./services/sendReminderEmails');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Rutas existentes
app.use('/api/auth', authRoutes);
app.use('/api/docs', docRoutes);

// Signers router montado en dos paths
app.use('/api/docs', signersRouter);  // para /api/docs/:id/signers, /api/docs/:id/sign
app.use('/api/signers', signersRouter); // para /api/signers/:id/auth

// Nueva ruta: enviar recordatorios de contratos pendientes
app.post('/api/recordatorios/pendientes', async (req, res) => {
  try {
    // Obtener todos los firmantes pendientes con info del documento
    const documentosPendientes = await new Promise((resolve, reject) => {
      db.all(
        `SELECT d.id, d.title, s.email as signer_email, s.name as signer_name, d.status
         FROM signers s
         JOIN documents d ON s.document_id = d.id
         WHERE s.status = 'pending'
         ORDER BY d.id, s."order"`,
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows || []);
        }
      );
    });

    if (documentosPendientes.length === 0) {
      return res.json({ message: 'No hay firmantes pendientes' });
    }

    await sendReminderEmail(documentosPendientes);
    res.json({ message: 'Recordatorios enviados correctamente', count: documentosPendientes.length });
  } catch (error) {
    console.error('Error al enviar recordatorios:', error);
    res.status(500).json({ message: 'Error al enviar recordatorios' });
  }
});

// Ruta básica de prueba
app.get('/', (req, res) => {
  res.send('API de DocDigital funcionando');
});

app.listen(PORT, () => {
  console.log('API escuchando en puerto', PORT);
});
