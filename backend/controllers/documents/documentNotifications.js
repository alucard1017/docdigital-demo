// backend/controllers/documents/documentNotifications.js (o donde lo tengas)
const {
  sendSigningInvitation,
  sendVisadoInvitation,
} = require("./common");

async function sendInvitationsInBackground({
  companyId,
  documentId,
  documentoId,
  docTitle,
  code,
  signers,
  actorName,
  signatureToken,
}) {
  const SIGNING_PORTAL_URL =
    process.env.SIGNING_PORTAL_URL || "https://firmar.verifirma.cl";

  // URL pública del documento (signature_token)
  const documentPublicUrl = `${SIGNING_PORTAL_URL}/document/${encodeURIComponent(
    signatureToken
  )}`;

  const jobs = signers.map(async (signer) => {
    try {
      // URL pública del firmante (sign_token)
      const signerPublicUrl = `${SIGNING_PORTAL_URL}/?token=${encodeURIComponent(
        signer.sign_token
      )}`;

      const payload = {
        companyId,
        documentId,
        documentoId,
        docTitle,
        signerName: signer.name || signer.nombre,
        signerEmail: signer.email,
        signerPhone: signer.phone || signer.telefono,
        verificationCode: code,
        publicUrl: signerPublicUrl,
        actorName,
        signerOrder: signer.signer_order || signer.orden,
        documentPublicUrl,
      };

      const isVisador =
        (signer.role || signer.tipo || "").toUpperCase() === "VISADOR" ||
        signer.debe_visar;

      if (isVisador) {
        await sendVisadoInvitation(
          payload.signerEmail,
          payload.docTitle,
          payload.documentPublicUrl,
          payload.signerName,
          {
            documentoId: payload.documentoId,
            firmanteId: null,
          }
        );
      } else {
        await sendSigningInvitation(
          payload.signerEmail,
          payload.docTitle,
          payload.publicUrl,
          payload.signerName,
          {
            verificationCode: payload.verificationCode,
            qrTargetUrl: payload.publicUrl,
            documentoId: payload.documentoId,
            firmanteId: null,
          }
        );
      }

      return { ok: true, email: signer.email };
    } catch (error) {
      console.error(
        `❌ Error enviando invitación a ${signer.email}:`,
        error.message
      );
      return { ok: false, email: signer.email, error: error.message };
    }
  });

  return Promise.allSettled(jobs);
}

module.exports = {
  sendInvitationsInBackground,
};