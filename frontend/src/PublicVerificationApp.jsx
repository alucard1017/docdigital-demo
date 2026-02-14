// frontend/src/PublicVerificationApp.jsx
import React from "react";
import { createRoot } from "react-dom/client";
import { VerificationView } from "./views/VerificationView";
import { API_BASE_URL } from "./constants";

function PublicVerificationApp() {
  return (
    <div className="public-verification-layout">
      <VerificationView API_URL={API_BASE_URL} />
    </div>
  );
}

const container = document.getElementById("root");
const root = createRoot(container);
root.render(<PublicVerificationApp />);
