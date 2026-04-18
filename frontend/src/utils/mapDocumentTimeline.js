// frontend/src/utils/mapDocumentTimeline.js
import { mapDocumentEvent } from "./mapDocumentEvent";

export function mapDocumentTimeline(rawEvents) {
  const eventsArray = Array.isArray(rawEvents) ? rawEvents : [];

  const mapped = eventsArray
    .map(mapDocumentEvent)
    .filter(Boolean)
    .sort((a, b) => {
      const at = a.timestamp ? a.timestamp.getTime() : 0;
      const bt = b.timestamp ? b.timestamp.getTime() : 0;
      return at - bt; // ascendente
    });

  return {
    events: mapped,
    progress: null, // aquí luego puedes enchufar el % desde backend
    currentStep: "", // y el estado actual si tu endpoint lo trae
    nextStep: "",
  };
}