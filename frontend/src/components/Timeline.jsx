import React from 'react';
import './Timeline.css';

export function Timeline({ timeline }) {
  if (!timeline || !timeline.events) {
    return (
      <div
        style={{
          padding: '20px',
          textAlign: 'center',
          color: '#94a3b8',
        }}
      >
        Cargando progreso...
      </div>
    );
  }

  const { events, progress, currentStep, nextStep } = timeline;

  const getEventIcon = (action) => {
    if (action === 'CREADO') return '📄';
    if (action === 'VISADO') return '✓';
    if (action === 'FIRMADO') return '✓';
    if (action === 'FIRMADO_PUBLICO') return '✓';
    if (action === 'RECHAZADO') return '✕';
    return '◉';
  };

  const getEventStatus = (index, totalEvents) => {
    if (index < totalEvents - 1) return 'completed';
    if (index === totalEvents - 1) return 'active';
    return 'pending';
  };

  return (
    <div className="timeline-container">
      {/* Header con progreso */}
      <div className="timeline-header">
        <h3
          style={{
            margin: '0 0 16px 0',
            color: '#1e293b',
            fontSize: '1.2rem',
            fontWeight: 800,
          }}
        >
          Progreso del Documento
        </h3>

        {/* Barra de progreso */}
        <div className="progress-bar-wrapper">
          <div className="progress-bar-background">
            <div
              className="progress-bar-fill"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: '8px',
              fontSize: '0.75rem',
              color: '#64748b',
            }}
          >
            <span>Inicio</span>
            <span style={{ fontWeight: 700, color: '#2563eb' }}>
              {progress}%
            </span>
            <span>Completado</span>
          </div>
        </div>

        {/* Estado actual */}
        <div
          style={{
            marginTop: '16px',
            padding: '12px 16px',
            background: '#f0f9ff',
            borderRadius: '12px',
            border: '1px solid #bae6fd',
          }}
        >
          <div
            style={{
              fontSize: '0.85rem',
              color: '#64748b',
              marginBottom: '4px',
            }}
          >
            Estado Actual
          </div>
          <div
            style={{
              fontSize: '1rem',
              fontWeight: 700,
              color: '#0369a1',
            }}
          >
            {currentStep}
          </div>
          <div
            style={{
              fontSize: '0.85rem',
              color: '#64748b',
              marginTop: '6px',
            }}
          >
            Próximo: {nextStep}
          </div>
        </div>
      </div>

      {/* Timeline de eventos */}
      <div className="timeline-events">
        {events.map((event, index) => {
          const status = getEventStatus(index, events.length);
          const isLast = index === events.length - 1;

          return (
            <div key={event.id} className="timeline-event-wrapper">
              {/* Línea vertical (excepto el último) */}
              {!isLast && (
                <div className={`timeline-line timeline-line-${status}`}></div>
              )}

              {/* Punto del evento */}
              <div className={`timeline-dot timeline-dot-${status}`}>
                <span className="timeline-icon">
                  {getEventIcon(event.action)}
                </span>
              </div>

              {/* Contenido del evento */}
              <div className={`timeline-content timeline-content-${status}`}>
                <h4
                  style={{
                    margin: '0 0 6px 0',
                    fontSize: '0.95rem',
                    fontWeight: 700,
                    color: '#1e293b',
                  }}
                >
                  {event.action === 'CREADO' && '📄 Documento Creado'}
                  {event.action === 'VISADO' && '✓ Documento Visado'}
                  {event.action === 'FIRMADO' && '✓ Documento Firmado'}
                  {event.action === 'FIRMADO_PUBLICO' &&
                    '✓ Documento firmado desde enlace público'}
                  {event.action === 'RECHAZADO' && '✕ Documento Rechazado'}
                  {event.action === 'FIRMADO_REPRESENTANTE' &&
                    '✓ Firmado por Representante'}
                </h4>

                <p
                  style={{
                    margin: '4px 0',
                    fontSize: '0.85rem',
                    color: '#475569',
                  }}
                >
                  {event.details}
                </p>

                <p
                  style={{
                    margin: '8px 0 0 0',
                    fontSize: '0.75rem',
                    color: '#94a3b8',
                  }}
                >
                  {new Date(event.timestamp).toLocaleString('es-CO', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>

                {event.actor && (
                  <p
                    style={{
                      margin: '4px 0 0 0',
                      fontSize: '0.75rem',
                      color: '#7c3aed',
                      fontWeight: 600,
                    }}
                  >
                    Por: {event.actor}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
