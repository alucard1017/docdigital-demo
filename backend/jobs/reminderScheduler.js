// backend/jobs/reminderScheduler.js
const cron = require('node-cron');
const { enviarRecordatoriosAutomaticos } = require('../services/reminderService');

/**
 * Inicia el scheduled job para enviar recordatorios cada 24 horas
 * Se ejecuta diariamente a las 9 AM (hora del servidor)
 */
function iniciarReminderScheduler() {
  // Cada día a las 9:00 AM
  const job = cron.schedule('0 9 * * *', async () => {
    console.log('⏰ Iniciando scheduled reminder job...');
    try {
      await enviarRecordatoriosAutomaticos();
    } catch (err) {
      console.error('❌ Error en scheduled reminder job:', err);
    }
  });

  console.log('✅ Reminder scheduler iniciado (diariamente a las 9 AM)');
  return job;
}

module.exports = {
  iniciarReminderScheduler,
};
