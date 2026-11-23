"use client";

import React, { useEffect, useState } from "react";
import StarRating from "../rating/StarRating";
import { backend } from "../../lib/backend";
import styles from "./reputation.module.css";

type Summary = {
  ratedCount: number;
  average: number;
  fourPlusCount: number;
  partnerStatus: "none" | "pending" | "certified";
  partnerSince: string | null;
  requirements: { minRated: number; minAvg: number };
  meetsRequirements: boolean;
  canApply: boolean;
};

/** Reputación de quien refiere y su camino a Socio Reclutador certificado. */
export default function ReputationCard() {
  const [data, setData] = useState<Summary | null>(null);
  const [failed, setFailed] = useState(false);
  const [applying, setApplying] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    try {
      setData(await backend<Summary>("reputation/me"));
    } catch {
      setFailed(true);
    }
  }
  useEffect(() => { load(); }, []);

  async function apply() {
    setApplying(true);
    setNotice(null);
    try {
      await backend("partner-applications", { method: "POST", body: message.trim() ? { message: message.trim() } : {} });
      setShowForm(false);
      setNotice("¡Solicitud enviada! El equipo de CME la revisará y te avisaremos.");
      await load();
    } catch {
      setNotice("No se pudo enviar la solicitud. Intenta de nuevo.");
    } finally {
      setApplying(false);
    }
  }

  if (failed || !data) return null;

  const { minRated, minAvg } = data.requirements;
  const pctCount = Math.min(100, Math.round((data.ratedCount / minRated) * 100));
  const missing = Math.max(0, minRated - data.ratedCount);

  return (
    <section className={styles.card} aria-label="Tu reputación">
      <div className={styles.head}>
        <div>
          <p className={styles.eyebrow}>Tu reputación como referidor</p>
          <div className={styles.score}>
            <span className={styles.big}>{data.ratedCount ? data.average.toFixed(1) : "—"}</span>
            <StarRating value={data.average} size={18} label="Promedio" />
            <span className={styles.muted}>
              {data.ratedCount} {data.ratedCount === 1 ? "recomendación calificada" : "recomendaciones calificadas"}
            </span>
          </div>
        </div>
        {data.partnerStatus === "certified" && (
          <span className={styles.badge}>Socio Reclutador certificado CME</span>
        )}
        {data.partnerStatus === "pending" && <span className={styles.badgePending}>Certificación en revisión</span>}
      </div>

      {data.partnerStatus === "none" && (
        <div className={styles.path}>
          <p className={styles.pathTitle}>Camino a Socio Reclutador</p>
          <div className={styles.req}>
            <span>{data.ratedCount} de {minRated} recomendaciones calificadas</span>
            <div className={styles.bar} role="progressbar" aria-valuemin={0} aria-valuemax={minRated} aria-valuenow={data.ratedCount}>
              <div className={styles.fill} style={{ width: `${pctCount}%` }} />
            </div>
          </div>
          <div className={styles.req}>
            <span>
              Promedio {data.ratedCount ? data.average.toFixed(2) : "—"} (mínimo {minAvg.toFixed(1)}){" "}
              {data.ratedCount > 0 && (data.average >= minAvg ? "✓" : "— aún no alcanza")}
            </span>
          </div>

          {data.canApply ? (
            showForm ? (
              <div className={styles.form}>
                <textarea
                  className={styles.textarea}
                  maxLength={1000}
                  placeholder="Opcional: cuéntanos tu experiencia reclutando o en qué sectores te mueves."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
                <div className={styles.actions}>
                  <button className={styles.secondary} onClick={() => setShowForm(false)} disabled={applying}>Cancelar</button>
                  <button className={styles.primary} onClick={apply} disabled={applying}>
                    {applying ? "Enviando…" : "Enviar solicitud"}
                  </button>
                </div>
              </div>
            ) : (
              <button className={styles.primary} onClick={() => setShowForm(true)}>
                Solicitar certificación de Socio Reclutador
              </button>
            )
          ) : (
            <p className={styles.muted}>
              {missing > 0
                ? `Te faltan ${missing} ${missing === 1 ? "recomendación calificada" : "recomendaciones calificadas"}. Las empresas califican cuando deciden sobre tu candidato.`
                : `Necesitas un promedio de ${minAvg.toFixed(1)} o más para solicitar la certificación.`}
            </p>
          )}
        </div>
      )}

      {notice && <p className={styles.notice}>{notice}</p>}
    </section>
  );
}
