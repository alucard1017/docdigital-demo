require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const docRoutes = require('./routes/documents');
const { sendReminderEmail } = require('./services/sendReminderEmails');

const app = express();

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Rutas existentes
app.use('/api/auth', authRoutes);
app.use('/api/docs', docRoutes);

// Nueva ruta: enviar recordatorios de contratos pendientes
app.post('/api/recordatorios/pendientes', async (req, res) => {
  try {
    // TODO: luego conectaremos aquí con tu base de datos real (SQLite).
    // De momento, documentos de ejemplo:
    const documentosPendientes = [
      {
        id: 1,
        signer_email: 'demo1@correo.com',
        nombre: 'Contrato de prueba 1',
        estado: 'PENDIENTE',
      },
      {
        id: 2,
        signer_email: 'demo2@correo.com',
        nombre: 'Contrato de prueba 2',
        estado: 'PENDIENTE',
      },
    ];

    let enviados = 0;

    for (const doc of documentosPendientes) {
      const ok = await sendReminderEmail(doc);
      if (ok) enviados++;
    }

    return res.json({
      mensaje: 'Recordatorios procesados',
      enviados,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error en el servidor al enviar recordatorios.' });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log('API escuchando en puerto', PORT));
