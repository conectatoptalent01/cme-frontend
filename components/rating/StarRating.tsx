"use client";

import React, { useState } from "react";

/**
 * Estrellas de 1 a 5. Con `onChange` son clicables (y navegables con teclado); sin él, solo muestran.
 */
export default function StarRating({
  value,
  onChange,
  size = 22,
  disabled,
  label = "Calificación",
}: {
  value: number;
  onChange?: (stars: number) => void;
  size?: number;
  disabled?: boolean;
  label?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const interactive = !!onChange && !disabled;
  const shown = hover ?? Math.round(value);

  return (
    <span
      role={interactive ? "radiogroup" : "img"}
      aria-label={interactive ? label : `${label}: ${value.toFixed(1)} de 5`}
      style={{ display: "inline-flex", gap: 2, verticalAlign: "middle" }}
      onMouseLeave={() => setHover(null)}
    >
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= shown;
        const star = (
          <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M12 .587l3.668 7.431 8.2 1.192-5.934 5.786 1.402 8.168L12 18.897l-7.336 3.867 1.402-8.168L.132 9.21l8.2-1.192z"
              fill={filled ? "#f59e0b" : "none"}
              stroke="#f59e0b"
              strokeWidth="1.2"
            />
          </svg>
        );
        if (!interactive) return <span key={n}>{star}</span>;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={Math.round(value) === n}
            aria-label={`${n} ${n === 1 ? "estrella" : "estrellas"}`}
            onMouseEnter={() => setHover(n)}
            onFocus={() => setHover(n)}
            onBlur={() => setHover(null)}
            onClick={() => onChange?.(n)}
            style={{ background: "none", border: "none", padding: 0, cursor: "pointer", lineHeight: 0 }}
          >
            {star}
          </button>
        );
      })}
    </span>
  );
}
