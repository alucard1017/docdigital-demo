// src/hooks/useAuth.js
import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";

export function useAuth() {
  const auth = useContext(AuthContext);

  if (auth === undefined || auth === null) {
    throw new Error("useAuth debe usarse dentro de AuthProvider");
  }

  return auth;
}
