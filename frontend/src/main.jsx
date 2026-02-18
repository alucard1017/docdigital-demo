// C:\Users\Usuario\Desktop\docdigital\frontend\src\main.jsx
import "./sentry"; // inicializa Sentry antes que nada

import React from "react";
import ReactDOM from "react-dom/client";
import * as Sentry from "@sentry/react";
import App from "./App.jsx";
import "./index.css";
import "./App.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Sentry.ErrorBoundary fallback={<p>Ocurrió un error. Intenta recargar la página.</p>}>
      <App />
    </Sentry.ErrorBoundary>
  </React.StrictMode>
);
