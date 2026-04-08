// import "./sentry"; // desactivado temporalmente

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";

import "./styles/base.css";
import "./styles/appShell.css";
import "./styles/layout.css";
import "./styles/formsAndCards.css";
import "./styles/detailView.css";
import "./styles/documentsTable.css";
import "./styles/sidebar.css";
import "./styles/listStates.css";
import "./styles/states.css";
import "./styles/badges.css";
import "./styles/inbox.css";
import "./styles/actionsTable.css";
import "./styles/auth.css";
import "./styles/authLegacy.css";
import "./styles/companiesAdmin.css";
import "./styles/usersAdmin.css";
import "./styles/decorativeTabs.css";

import { AuthProvider } from "./context/AuthContext.jsx";
import { ToastProvider } from "./components/feedback/ToastProvider.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ToastProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ToastProvider>
  </React.StrictMode>
);