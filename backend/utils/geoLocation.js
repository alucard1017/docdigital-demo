// backend/utils/geoLocation.js
const axios = require("axios");

/**
 * Obtener geolocalización aproximada desde IP usando ipapi.co (gratis, 1000/día)
 */
async function getGeoFromIP(ip) {
  if (!ip || ip === "127.0.0.1" || ip === "::1") {
    return { country: "Local", city: "Localhost", lat: null, lon: null };
  }

  try {
    const res = await axios.get(`https://ipapi.co/${ip}/json/`, {
      timeout: 3000,
    });

    return {
      country: res.data.country_name || "Desconocido",
      city: res.data.city || "Desconocido",
      region: res.data.region || null,
      lat: res.data.latitude || null,
      lon: res.data.longitude || null,
    };
  } catch (err) {
    console.error("⚠️ Error obteniendo geo de IP:", err.message);
    return { country: "Desconocido", city: "Desconocido", lat: null, lon: null };
  }
}

module.exports = { getGeoFromIP };
