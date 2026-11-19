import { useState, useMemo, useEffect } from "react";
import useSWR from "swr";
import Image from "next/image";
import { useRouter } from "next/navigation";
import styles from "./job.module.css";
import { PropagateLoader } from "react-spinners";

type Props = { jobId: string };

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("Error en la solicitud");
    return r.json();
  });

function short(id: string) {
  if (!id) return "";
  return `${id.slice(0, 4)}…${id.slice(-4)}`;
}

function Modal({
  open,
  title,
  message,
  onClose,
}: {
  open: boolean;
  title: string;
  message: string;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className={styles.modalOverlay} role="dialog" aria-modal="true">
      <div className={styles.modalCard}>
        <h3 className={styles.modalTitle}>{title}</h3>
        <p className={styles.modalBody}>{message}</p>
        <div className={styles.modalActions}>
          <button className={styles.primaryBtn} onClick={onClose} autoFocus>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

type InviteResult = {
  inviteUrl: string;
  shareText: string;
  expiresAt: string;
  whatsapp: { mode: "simulated" | "meta"; status: "simulated" | "sent" | "failed"; to: string };
};

const INVITE_ERRORS: Record<string, string> = {
  invalid_phone: "Revisa el teléfono. Ejemplos: 6123-4567 o +57 300 123 4567.",
  phone_already_invited_for_job: "Ese teléfono ya tiene una invitación activa para esta vacante.",
  cannot_refer_to_own_company: "No puedes referir candidatos a una vacante de tu propia empresa.",
  name_required: "Escribe nombre y apellido.",
};

/**
 * Referir a alguien: solo nombre, apellido y teléfono (+ por qué lo recomiendas, opcional).
 * CME le envía la invitación por WhatsApp; el candidato completa sus datos al aceptar.
 */
function ReferModal({
  open,
  jobId,
  jobTitle,
  onClose,
  disabled,
}: {
  open: boolean;
  jobId: string;
  jobTitle: string;
  jobUrl: string;
  onClose: () => void;
  disabled?: boolean;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<InviteResult | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) {
      setFirstName(""); setLastName(""); setPhone(""); setNote("");
      setBusy(false); setError(null); setResult(null); setCopied(false);
    }
  }, [open]);

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!firstName.trim() || !lastName.trim() || !phone.trim()) {
      setError("Completa nombre, apellido y teléfono.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        credentials: "include",
        body: JSON.stringify({ jobOfferId: jobId, firstName, lastName, phone, note: note.trim() || undefined }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 401) { setError("Inicia sesión para referir."); return; }
      if (!res.ok) {
        setError(INVITE_ERRORS[json?.error] || "No se pudo crear la invitación. Intenta de nuevo.");
        return;
      }
      setResult(json as InviteResult);
    } catch {
      setError("Problema de conexión. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    if (!result) return;
    try { await navigator.clipboard.writeText(result.inviteUrl); setCopied(true); } catch { }
  }

  /** Abre el WhatsApp de quien refiere con el mismo mensaje y el enlace de la invitación. */
  function shareFromMyWhatsApp() {
    if (!result) return;
    const digits = phone.replace(/\D/g, "");
    const to = digits.length <= 8 ? `507${digits}` : digits;
    window.open(`https://wa.me/${to}?text=${encodeURIComponent(result.shareText)}`, "_blank", "noopener,noreferrer");
  }

  if (!open) return null;

  if (disabled) {
    return (
      <div className={styles.modalOverlay} role="dialog" aria-modal="true">
        <div className={styles.modalCard}>
          <div className={styles.text}>No puedes referir candidatos a una vacante de tu propia empresa.</div>
          <div className={styles.modalActions}>
            <button className={styles.secundaryBtn} onClick={onClose}>Cerrar</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-label="Referir a un candidato">
      <div className={styles.modalCard}>
        {!result ? (
          <form className={styles.referSection} onSubmit={sendInvite} noValidate>
            <p className={styles.text}>
              Recomienda a alguien para <b>{jobTitle}</b>. Solo necesitamos su nombre y su WhatsApp:
              le enviaremos la invitación y él completará sus datos al aceptar.
            </p>

            <div className={styles.formGrid} style={{ width: "100%" }}>
              <label className={styles.formField}>
                <span>Nombre</span>
                <input className={styles.input} value={firstName} onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Ej: Laura" maxLength={80} autoComplete="off" />
              </label>
              <label className={styles.formField}>
                <span>Apellido</span>
                <input className={styles.input} value={lastName} onChange={(e) => setLastName(e.target.value)}
                  placeholder="Ej: Pérez" maxLength={80} autoComplete="off" />
              </label>
              <label className={styles.formField}>
                <span>Teléfono con WhatsApp</span>
                <input className={styles.input} type="tel" inputMode="tel" value={phone}
                  onChange={(e) => setPhone(e.target.value)} placeholder="6123-4567 o +57 300 123 4567" />
              </label>
              <label className={styles.formField}>
                <span>¿Por qué lo recomiendas? (opcional)</span>
                <input className={styles.input} value={note} onChange={(e) => setNote(e.target.value)}
                  placeholder="Ej: trabajamos juntos 3 años, es excelente con clientes" maxLength={280} />
              </label>
            </div>

            {error && <div className={styles.error}>{error}</div>}

            <div className={styles.modalSubActions}>
              <button type="submit" className={styles.primaryBtn} disabled={busy} aria-busy={busy}>
                {busy ? "Enviando..." : "Enviar invitación"}
              </button>
            </div>
          </form>
        ) : (
          <div className={styles.referSection}>
            {result.whatsapp.status === "sent" ? (
              <p className={styles.text}>
                Listo: le enviamos la invitación por WhatsApp a <b>{firstName}</b> ({result.whatsapp.to}).
                Te avisaremos cuando responda.
              </p>
            ) : (
              <p className={styles.text}>
                Invitación creada para <b>{firstName}</b>.{" "}
                {result.whatsapp.status === "simulated"
                  ? "El envío automático por WhatsApp todavía no está activo: envíasela tú desde tu WhatsApp."
                  : "No pudimos enviarla automáticamente por WhatsApp: envíasela tú desde tu WhatsApp."}
              </p>
            )}

            <div className={styles.referCode} style={{ marginTop: 8 }}>
              <button type="button" className={styles.secundaryBtnWPP} onClick={shareFromMyWhatsApp}>
                Enviar desde mi WhatsApp
              </button>
              <button type="button" className={styles.secundaryBtn} onClick={copyLink} style={{ marginLeft: 8 }}>
                {copied ? "Enlace copiado" : "Copiar enlace"}
              </button>
              <p className={styles.small}>
                La invitación vence el {new Date(result.expiresAt).toLocaleDateString("es-PA", { day: "numeric", month: "long" })}.
              </p>
            </div>
          </div>
        )}

        <div className={styles.modalActions}>
          <button className={styles.secundaryBtn} onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

export default function JobDetailClient({ jobId }: Props) {
  const router = useRouter();

  const { data, error, isLoading } = useSWR(
    jobId ? `/api/jobs/${jobId}` : null,
    fetcher
  );

  const { data: meData } = useSWR(`/api/me`, fetcher);
  const userId: string | null = meData?.user?.id ?? meData?.id ?? null;
  const role: string | null =
    meData?.user?.role ??
    meData?.role ??
    meData?.profile?.role ??
    null;

  const isCompanyAdmin = role === "company_admin";

  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalMsg, setModalMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [referOpen, setReferOpen] = useState(false);

  const [absJobUrl, setAbsJobUrl] = useState<string>("");

  useEffect(() => {
    if (typeof window !== "undefined" && jobId) {
      setAbsJobUrl(`${window.location.origin}/jobs/${jobId}`);
    }
  }, [jobId]);

  function openModal(title: string, message: string) {
    setModalTitle(title);
    setModalMsg(message);
    setModalOpen(true);
  }

  if (!jobId) return null;
  if (isLoading)
    return (
      <div className={styles.loading}>
        <PropagateLoader />
      </div>
    );
  if (error || !data?.job)
    return <div className={styles.error}>No se pudo cargar la oferta.</div>;

  const { job, company } = data as {
    job: {
      id: string;
      company_id: string | null;
      title: string;
      description?: string | null;
      employment_type?: string | null;
      location_type?: string | null;
      skills?: string[] | null;
      requirements?: string | null;
      location?: string | null;
      salary?: number | null;
      currency?: string | null;
    };
    company: {
      name?: string | null;
      profilePicture?: string | null;
      coverPhoto?: string | null;
      location?: string | null;
    } | null;
  };

  const salary =
    job.salary == null
      ? "—"
      : new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: job.currency ?? "USD",
        maximumFractionDigits: 2,
      }).format(job.salary);

  const companyName =
    company?.name ?? (job.company_id ? `Company #${short(job.company_id)}` : "Company");
  const companyLogo = company?.profilePicture ?? null;
  const companyCover = company?.coverPhoto ?? null;
  const loc = job.location ?? company?.location ?? "—";

  async function showInterest() {
    if (isCompanyAdmin) {
      openModal("No disponible", "Esta acción no está disponible para tu rol.");
      return;
    }
    if (!userId) {
      router.push(`/login?next=/jobs/${jobId}`);
      return;
    }

    const mapErrorToEs = (status: number, rawMsg: string | undefined) => {
      const msg = String(rawMsg || "").toLowerCase();
      if (status === 409 || /already_applied|application already exists|duplicate key|23505/.test(msg)) {
        return "Ya mostraste tu interes a esta oferta.";
      }
      if (status === 401 || /unauth|not\s*authenticated|forbidden|missing token/.test(msg)) {
        return "No autorizado. Inicia sesión para continuar.";
      }
      return "No se pudo mostrar interes. Intenta nuevamente.";
    };

    setSubmitting(true);
    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: job.id,
          notes: "",
        }),
      });

      const raw = await res.text();
      let payload: any = null;
      try { payload = raw ? JSON.parse(raw) : null; } catch { }

      if (res.status === 401) {
        router.push(`/login?next=/jobs/${jobId}`);
        return;
      }

      if (!res.ok) {
        const custom = mapErrorToEs(res.status, payload?.error || payload?.message);
        openModal(res.status === 409 ? "Ya aplicaste" : "Error", custom);
        return;
      }

      openModal("¡Listo!", "Mostraste tu interes exitosamente.");
    } catch {
      openModal("Error", "No se pudo mostrar interes. Intenta nuevamente.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.main}>
      <Modal
        open={modalOpen}
        title={modalTitle}
        message={modalMsg}
        onClose={() => setModalOpen(false)}
      />

      <ReferModal
        open={referOpen}
        jobId={job.id}
        jobTitle={job.title}
        jobUrl={absJobUrl || `/jobs/${job.id}`}
        onClose={() => setReferOpen(false)}
        disabled={isCompanyAdmin}
      />

      <div className={styles.modal}>
        <div className={styles.cover}>
          {companyCover ? (
            <Image src={companyCover} alt="" fill className={styles.coverImg} priority />
          ) : null}
        </div>

        <div className={styles.infoSection}>
          <div className={styles.logoWrapper}>
            {companyLogo ? (
              <Image
                src={companyLogo}
                alt={companyName}
                width={72}
                height={72}
                className={styles.logoImg}
              />
            ) : (
              <div className={styles.logoPlaceholder} />
            )}
          </div>

          <div className={styles.header}>
            <div className={styles.meta}>
              {companyName} · {loc}
            </div>
            <div className={styles.title}>{job.title}</div>

            <div className={styles.textSection}>
              <p>
                <b>Tipo:</b> {job.employment_type ?? "—"}
              </p>
              {" · "}
              <p>
                <b>Modalidad:</b> {job.location_type ?? "—"}
              </p>
            </div>

            <div>
              <b>Salario:</b> {salary}
            </div>
          </div>

          {Array.isArray(job.skills) && job.skills.length > 0 && (
            <div className={styles.skills}>
              {job.skills.map((s) => (
                <span key={s} className={styles.skill}>
                  {s}
                </span>
              ))}
            </div>
          )}

          {job.description && (
            <div>
              <h3>Descripción</h3>
              <p className={styles.text}>{job.description}</p>
            </div>
          )}

          {job.requirements && (
            <div>
              <h3>Requisitos</h3>
              <p className={styles.text}>{job.requirements}</p>
            </div>
          )}

          {!isCompanyAdmin && (
            <div className={styles.actions}>
              <button
                className={styles.primaryBtn}
                onClick={showInterest}
                disabled={submitting}
                aria-busy={submitting}
              >
                {submitting ? "Enviando..." : "Mostrar Interes"}
              </button>

              <button
                type="button"
                className={styles.secundaryBtn}
                onClick={() => setReferOpen(true)}
              >
                Referir
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
