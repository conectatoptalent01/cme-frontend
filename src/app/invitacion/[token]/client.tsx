"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "./invitation.module.css";

type Invitation = {
  inviteeFirstName: string;
  referrerFirstName: string;
  recommendationNote?: string | null;
  job: { id: string; title: string; companyName: string };
  expiresAt: string;
};

type View =
  | { kind: "loading" }
  | { kind: "ready"; inv: Invitation }
  | { kind: "gone"; reason: "expired" | "used" }
  | { kind: "declined" }
  | { kind: "error"; message: string };

const ERRORS: Record<string, string> = {
  cannot_accept_own_referral: "No puedes aceptar una recomendación que hiciste tú.",
  company_admin_cannot_be_candidate: "Esta vacante es de tu empresa: no puedes postularte a ella.",
  already_referred_for_job: "Ya estás postulado a esta vacante por otra recomendación.",
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("es-PA", { day: "numeric", month: "long" });

export default function InvitationClient({ token }: { token: string }) {
  const router = useRouter();
  const [view, setView] = useState<View>({ kind: "loading" });
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const res = await fetch(`/api/invitations/${encodeURIComponent(token)}`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!alive) return;
      if (res.ok) return setView({ kind: "ready", inv: json as Invitation });
      if (res.status === 410) return setView({ kind: "gone", reason: "expired" });
      if (res.status === 404) return setView({ kind: "gone", reason: "used" });
      setView({ kind: "error", message: "No pudimos cargar la invitación. Intenta de nuevo en unos minutos." });
    })();
    return () => { alive = false; };
  }, [token]);

  const here = `/invitacion/${encodeURIComponent(token)}`;

  async function accept() {
    setActionError(null);
    setBusy("accept");
    try {
      const res = await fetch(`/api/invitations/${encodeURIComponent(token)}/accept`, {
        method: "POST",
        credentials: "include",
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 401) {
        // Sin sesión: registrarse (o iniciar sesión) y volver a esta misma página.
        router.push(`/register?next=${encodeURIComponent(here)}`);
        return;
      }
      if (res.status === 410) return setView({ kind: "gone", reason: "expired" });
      if (res.status === 404) return setView({ kind: "gone", reason: "used" });
      if (!res.ok) {
        setActionError(ERRORS[json?.error] || "No se pudo aceptar la invitación. Intenta de nuevo.");
        return;
      }
      const missing: string[] = json?.missingProfileFields ?? [];
      const jobPath = `/jobs/${encodeURIComponent(json.jobOfferId)}`;
      router.push(
        missing.length
          ? `/settings?completar=1&next=${encodeURIComponent(jobPath)}`
          : jobPath,
      );
    } finally {
      setBusy(null);
    }
  }

  async function decline() {
    if (!window.confirm("¿Seguro que no quieres participar? Borraremos tu nombre y teléfono.")) return;
    setActionError(null);
    setBusy("decline");
    try {
      const res = await fetch(`/api/invitations/${encodeURIComponent(token)}/decline`, { method: "POST" });
      if (res.ok) return setView({ kind: "declined" });
      if (res.status === 410) return setView({ kind: "gone", reason: "expired" });
      if (res.status === 404) return setView({ kind: "gone", reason: "used" });
      setActionError("No se pudo registrar tu respuesta. Intenta de nuevo.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <p className={styles.brand}>CME · Conéctame</p>

        {view.kind === "loading" && <p className={styles.muted}>Cargando tu invitación…</p>}

        {view.kind === "ready" && (
          <>
            <h1 className={styles.title}>
              Hola {view.inv.inviteeFirstName}, {view.inv.referrerFirstName} te recomendó
            </h1>
            <div className={styles.job}>
              <span className={styles.jobLabel}>Vacante</span>
              <strong className={styles.jobTitle}>{view.inv.job.title}</strong>
              <span className={styles.company}>{view.inv.job.companyName}</span>
              <Link className={styles.link} href={`/jobs/${encodeURIComponent(view.inv.job.id)}`} target="_blank">
                Ver la oferta completa
              </Link>
            </div>

            {view.inv.recommendationNote && (
              <blockquote className={styles.note}>
                “{view.inv.recommendationNote}”
                <span>— {view.inv.referrerFirstName}</span>
              </blockquote>
            )}

            <p className={styles.text}>
              Si te interesa, acepta y crea tu cuenta gratis. Luego completas tu perfil (cédula y CV) y
              quedas postulado. La empresa solo verá tu postulación cuando aceptes.
            </p>

            <div className={styles.actions}>
              <button className={styles.primary} onClick={accept} disabled={!!busy}>
                {busy === "accept" ? "Un momento…" : "Me interesa"}
              </button>
              <button className={styles.secondary} onClick={decline} disabled={!!busy}>
                {busy === "decline" ? "Un momento…" : "No me interesa"}
              </button>
            </div>
            {actionError && <p className={styles.error}>{actionError}</p>}

            <p className={styles.small}>
              Esta invitación vence el {fmtDate(view.inv.expiresAt)}. Si no respondes, borraremos tu nombre y
              teléfono.
            </p>
          </>
        )}

        {view.kind === "declined" && (
          <>
            <h1 className={styles.title}>Listo, gracias por responder</h1>
            <p className={styles.text}>Borramos tu nombre y tu teléfono. No volveremos a escribirte por esta vacante.</p>
          </>
        )}

        {view.kind === "gone" && (
          <>
            <h1 className={styles.title}>
              {view.reason === "expired" ? "Esta invitación venció" : "Esta invitación ya no está disponible"}
            </h1>
            <p className={styles.text}>
              {view.reason === "expired"
                ? "Pasó el plazo para responder y tus datos fueron borrados."
                : "Ya fue respondida o el enlace no es válido."}{" "}
              Igual puedes ver las vacantes abiertas en CME.
            </p>
            <Link className={styles.primaryLink} href="/">Ver vacantes</Link>
          </>
        )}

        {view.kind === "error" && <p className={styles.error}>{view.message}</p>}
      </section>
    </main>
  );
}
