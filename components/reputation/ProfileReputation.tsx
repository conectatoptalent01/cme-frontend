"use client";

import React, { useEffect, useState } from "react";
import StarRating from "../rating/StarRating";
import { backend } from "../../lib/backend";
import styles from "./reputation.module.css";

type Summary = { ratedCount: number; average: number; partnerStatus: "none" | "pending" | "certified"; partnerSince: string | null };

/** En el perfil público: sello de Socio Reclutador y reputación como referidor (si tiene calificaciones). */
export default function ProfileReputation({ userId }: { userId: string }) {
  const [s, setS] = useState<Summary | null>(null);
  useEffect(() => {
    backend<Summary>(`reputation/referrers/${encodeURIComponent(userId)}`).then(setS).catch(() => setS(null));
  }, [userId]);

  if (!s || (s.ratedCount === 0 && s.partnerStatus !== "certified")) return null;
  return (
    <div className={styles.inline}>
      {s.partnerStatus === "certified" && (
        <span className={styles.badge} title={s.partnerSince ? `Desde ${new Date(s.partnerSince).toLocaleDateString("es-PA")}` : undefined}>
          Socio Reclutador certificado CME
        </span>
      )}
      {s.ratedCount > 0 && (
        <span className={styles.muted}>
          <StarRating value={s.average} size={14} label="Reputación como referidor" /> {s.average.toFixed(1)} como referidor ·{" "}
          {s.ratedCount} {s.ratedCount === 1 ? "recomendación calificada" : "recomendaciones calificadas"}
        </span>
      )}
    </div>
  );
}
