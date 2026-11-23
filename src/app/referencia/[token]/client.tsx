"use client";

import { useEffect, useState } from "react";
import styles from "../../invitacion/[token]/invitation.module.css";

type Info = {
  referenceFirstName: string;
  candidateName: string;
  companyName: string;
  relationship: string;
  expiresAt: string;
};

type View =
  | { kind: "loading" }
  | { kind: "ready"; info: Info }
  | { kind: "done"; confirmed: boolean; candidate: string }
  | { kind: "gone"; expired: boolean }
  | { kind: "error" };

/** Página pública: la referencia laboral confirma (o no) que trabajó con el candidato. Sin cuenta. */
export default function ReferenceClient({ token }: { token: string }) {
  const [view, setView] = useState<View>({ kind: "loading" });
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const base = `/api/backend/work-references/public/${encodeURIComponent(token)}`;

  useEffect(() => {
    (async () => {
      const res = await fetch(base, { cache: "no-store" });
      if (res.ok) return setView({ kind: "ready", info: await res.json() });
      if (res.status === 410) return setView({ kind: "gone", expired: true });
      if (res.status === 404) return setView({ kind: "gone", expired: false });
      setView({ kind: "error" });
    })();
  }, [base]);

  async function respond(confirm: boolean) {
    if (view.kind !== "ready") return;
    setBusy(true);
    try {
      const res = await fetch(`${base}/${confirm ? "confirm" : "decline"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(confirm && comment.trim() ? { comment: comment.trim() } : {}),
      });
      if (res.ok) return setView({ kind: "done", confirmed: confirm, candidate: view.info.candidateName });
      if (res.status === 410) return setView({ kind: "gone", expired: true });
      if (res.status === 404) return setView({ kind: "gone", expired: false });
      setView({ kind: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <p className={styles.brand}>CME · Conéctame</p>

        {view.kind === "loading" && <p className={styles.muted}>Cargando…</p>}

        {view.kind === "ready" && (
          <>
            <h1 className={styles.title}>Hola {view.info.referenceFirstName}, ¿confirmas esta referencia?</h1>
            <div className={styles.job}>
              <span className={styles.jobLabel}>Candidato</span>
              <strong className={styles.jobTitle}>{view.info.candidateName}</strong>
              <span className={styles.company}>
                Te indicó como <b>{view.info.relationship}</b> en <b>{view.info.companyName}</b>.
              </span>
            </div>
            <p className={styles.text}>
              Si es correcto, confírmalo. Puedes dejar un comentario breve que verán las empresas donde postule.
              No necesitas crear una cuenta.
            </p>
            <textarea
              aria-label="Comentario opcional"
              maxLength={500}
              placeholder="Opcional: ¿cómo fue trabajar con esta persona?"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              style={{ width: "100%", boxSizing: "border-box", minHeight: 88, padding: 12, borderRadius: 10, border: "1px solid #d1d5db", font: "inherit", marginBottom: 16 }}
            />
            <div className={styles.actions}>
              <button className={styles.primary} onClick={() => respond(true)} disabled={busy}>
                {busy ? "Un momento…" : "Sí, confirmo"}
              </button>
              <button className={styles.secondary} onClick={() => respond(false)} disabled={busy}>
                No lo conozco / no es correcto
              </button>
            </div>
            <p className={styles.small}>
              Este enlace vence el {new Date(view.info.expiresAt).toLocaleDateString("es-PA", { day: "numeric", month: "long" })}.
              Tu número de teléfono no se muestra a nadie y se borra al responder.
            </p>
          </>
        )}

        {view.kind === "done" && (
          <>
            <h1 className={styles.title}>¡Gracias por responder!</h1>
            <p className={styles.text}>
              {view.confirmed
                ? `Registramos tu confirmación. Le avisaremos a ${view.candidate}.`
                : "Registramos tu respuesta. No volveremos a escribirte por esta referencia."}
            </p>
          </>
        )}

        {view.kind === "gone" && (
          <>
            <h1 className={styles.title}>{view.expired ? "Este enlace venció" : "Este enlace ya no está disponible"}</h1>
            <p className={styles.text}>
              {view.expired ? "Pasó el plazo para responder." : "Ya fue respondido o no es válido."} No necesitas hacer nada más.
            </p>
          </>
        )}

        {view.kind === "error" && <p className={styles.error}>No pudimos cargar la página. Intenta de nuevo en unos minutos.</p>}
      </section>
    </main>
  );
}
