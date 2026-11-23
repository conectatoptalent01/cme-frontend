"use client";

import React, { useEffect, useState } from "react";
import StarRating from "../../../../components/rating/StarRating";
import { backend } from "../../../../lib/backend";
import styles from "./admin.module.css";

type Application = {
  id: string;
  user_id: string;
  status: "pending" | "approved" | "rejected";
  message: string | null;
  rated_count: number;
  avg_stars: string | number;
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  full_name: string | null;
  email: string | null;
};

type Tab = "pending" | "approved" | "rejected";
const TAB_LABEL: Record<Tab, string> = { pending: "Pendientes", approved: "Aprobadas", rejected: "Rechazadas" };

/** Panel de admin: aprobar o rechazar solicitudes de Socio Reclutador. */
export default function PartnerApplicationsAdmin() {
  const [tab, setTab] = useState<Tab>("pending");
  const [items, setItems] = useState<Application[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load(t: Tab) {
    setItems(null);
    setError(null);
    try {
      setItems(await backend<Application[]>(`partner-applications?status=${t}`));
    } catch (e: any) {
      setError(e?.status === 403 ? "Esta sección es solo para administradores de CME." : "No se pudieron cargar las solicitudes.");
    }
  }
  useEffect(() => { load(tab); }, [tab]);

  async function review(app: Application, approve: boolean) {
    if (!approve && !window.confirm(`¿Rechazar la solicitud de ${app.full_name ?? "este usuario"}?`)) return;
    setBusyId(app.id);
    try {
      const note = notes[app.id]?.trim();
      await backend(`partner-applications/${app.id}/${approve ? "approve" : "reject"}`, {
        method: "POST",
        body: note ? { note } : {},
      });
      setItems((prev) => (prev ?? []).filter((a) => a.id !== app.id));
    } catch {
      setError("No se pudo guardar la decisión. Intenta de nuevo.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Solicitudes de Socio Reclutador</h1>
        <p className={styles.sub}>
          Requisito para solicitar: 15 o más recomendaciones calificadas y promedio de 4 estrellas o más.
        </p>
      </header>

      <nav className={styles.tabs} aria-label="Filtrar solicitudes">
        {(Object.keys(TAB_LABEL) as Tab[]).map((t) => (
          <button key={t} className={`${styles.tab} ${t === tab ? styles.tabActive : ""}`} onClick={() => setTab(t)}>
            {TAB_LABEL[t]}
          </button>
        ))}
      </nav>

      {error && <p className={styles.error}>{error}</p>}
      {!error && items === null && <p className={styles.muted}>Cargando…</p>}
      {!error && items?.length === 0 && <p className={styles.muted}>No hay solicitudes {TAB_LABEL[tab].toLowerCase()}.</p>}

      <ul className={styles.list}>
        {items?.map((a) => (
          <li key={a.id} className={styles.item}>
            <div className={styles.row}>
              <div>
                <a className={styles.name} href={`/profiles/users?id=${a.user_id}`} target="_blank" rel="noopener noreferrer">
                  {a.full_name ?? "Sin nombre"}
                </a>
                <div className={styles.muted}>{a.email}</div>
              </div>
              <div className={styles.stats}>
                <StarRating value={Number(a.avg_stars)} size={16} label="Promedio" />
                <span>{Number(a.avg_stars).toFixed(2)} · {a.rated_count} calificadas</span>
                <span className={styles.muted}>Solicitó el {new Date(a.created_at).toLocaleDateString("es-PA")}</span>
              </div>
            </div>

            {a.message && <blockquote className={styles.message}>{a.message}</blockquote>}

            {a.status === "pending" ? (
              <div className={styles.review}>
                <input
                  className={styles.input}
                  placeholder="Nota para el solicitante (opcional, se le envía si rechazas)"
                  maxLength={1000}
                  value={notes[a.id] ?? ""}
                  onChange={(e) => setNotes((n) => ({ ...n, [a.id]: e.target.value }))}
                />
                <button className={styles.secondary} onClick={() => review(a, false)} disabled={busyId === a.id}>Rechazar</button>
                <button className={styles.primary} onClick={() => review(a, true)} disabled={busyId === a.id}>Aprobar y certificar</button>
              </div>
            ) : (
              <p className={styles.muted}>
                {a.status === "approved" ? "Aprobada" : "Rechazada"}
                {a.reviewed_at ? ` el ${new Date(a.reviewed_at).toLocaleDateString("es-PA")}` : ""}
                {a.review_note ? ` · Nota: ${a.review_note}` : ""}
              </p>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
