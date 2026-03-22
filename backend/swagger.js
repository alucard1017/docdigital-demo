// backend/swagger.js
const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "VeriFirma API",
      version: "1.0.0",
      description: "Plataforma de firma digital electrónica",
      contact: {
        name: "VeriFirma",
        email: "support@verifirma.cl",
      },
    },
    servers: [
      {
        url: process.env.API_URL || "http://localhost:4000",
        description: "Servidor principal",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ["./routes/*.js"],
};

const specs = swaggerJsdoc(options);

/**
 * Monta Swagger UI y endpoint JSON.
 */
function setupSwagger(app) {
  app.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(specs, {
      explorer: true,
      customSiteTitle: "VeriFirma API Docs",
    })
  );

  app.get("/api-docs.json", (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.send(specs);
  });
}

module.exports = {
  swaggerUi,
  specs,
  setupSwagger,
};
