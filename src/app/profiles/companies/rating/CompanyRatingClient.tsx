"use client";

import React from "react";

/**
 * Muestra la calificación de la empresa (solo lectura).
 *
 * Antes cualquier usuario podía hacer clic en las estrellas y SOBRESCRIBIR la calificación
 * de la empresa (y la llamada además fallaba porque la ruta no existía). La calificación
 * real —un voto por usuario y un promedio— se construye en la Fase 4 (Reputación).
 */
function Star({ filled, size = 22 }: { filled: boolean; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={{ verticalAlign: "middle" }}
      aria-hidden="true"
    >
      <path
        d="M12 .587l3.668 7.431 8.2 1.192-5.934 5.786 1.402 8.168L12 18.897l-7.336 3.867 1.402-8.168L.132 9.21l8.2-1.192z"
        fill={filled ? "#f59e0b" : "none"}
        stroke="#f59e0b"
        strokeWidth="1.2"
      />
    </svg>
  );
}

export default function CompanyRatingClient({
  initialRating = 0,
  className,
  valueClassName,
}: {
  companyId?: string;
  initialRating?: number;
  className?: string;
  valueClassName?: string;
}) {
  const value = Math.max(0, Math.min(5, Number(initialRating) || 0));
  return (
    <div className={className} role="img" aria-label={`Calificación ${value.toFixed(1)} de 5`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Star key={i} filled={i < Math.round(value)} />
      ))}
      <span className={valueClassName} style={{ marginLeft: 8 }}>
        {value.toFixed(1)}
      </span>
    </div>
  );
}
