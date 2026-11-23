"use client";

import React, { useEffect, useState } from "react";
import StarRating from "../../../../../components/rating/StarRating";
import { backend } from "../../../../../lib/backend";

type Rating = {
  average: number;
  count: number;
  myRating: { stars: number; comment: string | null } | null;
  canRate: boolean;
};

/**
 * Calificación de la empresa: promedio de un voto por persona.
 * Pueden votar quienes postularon a una de sus vacantes o le recomendaron a alguien (lo valida el backend).
 */
export default function CompanyRatingClient({
  companyId,
  initialRating = 0,
  className,
  valueClassName,
}: {
  companyId?: string;
  initialRating?: number;
  className?: string;
  valueClassName?: string;
}) {
  const [data, setData] = useState<Rating | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) return;
    backend<Rating>(`companies/${encodeURIComponent(companyId)}/rating`).then(setData).catch(() => setData(null));
  }, [companyId]);

  async function rate(stars: number) {
    if (!companyId) return;
    setSaving(true);
    setMsg(null);
    try {
      setData(await backend<Rating>(`companies/${encodeURIComponent(companyId)}/rating`, { method: "POST", body: { stars } }));
      setMsg("¡Gracias! Guardamos tu calificación.");
    } catch {
      setMsg("No se pudo guardar tu calificación.");
    } finally {
      setSaving(false);
    }
  }

  const average = data ? data.average : Math.max(0, Math.min(5, Number(initialRating) || 0));
  const count = data?.count ?? null;

  return (
    <div className={className}>
      <StarRating value={average} label="Calificación de la empresa" />
      <span className={valueClassName} style={{ marginLeft: 8 }}>
        {average.toFixed(1)}
        {count !== null && (
          <span style={{ marginLeft: 6, fontSize: "0.85em", opacity: 0.75 }}>
            ({count} {count === 1 ? "opinión" : "opiniones"})
          </span>
        )}
      </span>

      {data?.canRate && (
        <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 14 }}>{data.myRating ? "Tu calificación:" : "¿Cómo fue tu experiencia con esta empresa?"}</span>
          <StarRating value={data.myRating?.stars ?? 0} onChange={rate} disabled={saving} size={20} label="Tu calificación" />
        </div>
      )}
      {msg && <div style={{ marginTop: 6, fontSize: 13 }}>{msg}</div>}
    </div>
  );
}
