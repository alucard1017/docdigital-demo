// frontend/src/components/Legal/ElectronicSignatureNotice.tsx
import React from "react";

interface ElectronicSignatureNoticeProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  mode?: "firma" | "visado"; // por defecto "firma"
}

export const ElectronicSignatureNotice: React.FC<ElectronicSignatureNoticeProps> = ({
  checked,
  onChange,
  mode = "firma",
}) => {
  const isVisado = mode === "visado";

  const mainText = isVisado
    ? "Antes de visar, declaro que he leído y revisado el contenido del documento, y que mi visado deja constancia de que su contenido ha sido validado para continuar el flujo de firma. Entiendo que este visado se realiza mediante firma electrónica simple y quedará registrado para fines de trazabilidad y responsabilidad."
    : "Antes de firmar, declaro que he leído y acepto los términos de uso de la firma electrónica simple y del documento que firmaré. Entiendo que la firma electrónica tiene la misma validez y efectos legales que mi firma manuscrita, conforme a la Ley N° 19.799 sobre documentos electrónicos y firma electrónica, y que soy responsable del uso de mis credenciales y del contenido del documento que apruebo.";

  const checkboxText = isVisado
    ? "Acepto realizar el visado de este documento utilizando firma electrónica simple y declaro que soy responsable del uso de mis datos y credenciales."
    : "Acepto firmar este documento utilizando firma electrónica simple y declaro que soy responsable del uso de mis datos y credenciales.";

  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        padding: 16,
        marginTop: 16,
        marginBottom: 16,
        backgroundColor: "#f9fafb",
      }}
    >
      <p style={{ fontSize: 14, color: "#374151", marginBottom: 12 }}>
        {mainText}
      </p>

      <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 12 }}>
        Puedes revisar el texto completo de la Ley N° 19.799 en la Biblioteca
        del Congreso Nacional de Chile:{" "}
        <a
          href="https://www.bcn.cl/leychile/navegar?idNorma=196640"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "#2563eb", textDecoration: "underline" }}
        >
          ver Ley N° 19.799
        </a>
        .
      </p>

      <label
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 8,
          fontSize: 14,
          color: "#111827",
          cursor: "pointer",
        }}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          style={{ marginTop: 2 }}
        />
        <span>{checkboxText}</span>
      </label>
    </div>
  );
};
