"use client";

import React, { useEffect, useMemo, useState } from "react";
import styles from "./newOffer.module.css";
import { useRouter } from "next/navigation";
import Link from "next/link";

type FeeQuote = { bracket: string; feeLabel: string; feeValue: number; feePercent?: number };
function computeCmeFeeUSD(salaryUSD: number): FeeQuote {
  if (!salaryUSD || salaryUSD <= 0) return { bracket: "—", feeLabel: "—", feeValue: 0 };
  if (salaryUSD <= 1000) return { bracket: "≤ 1,000", feeLabel: "US$150", feeValue: 150 };
  if (salaryUSD <= 2500) return { bracket: "1,001–2,500", feeLabel: "US$250", feeValue: 250 };
  if (salaryUSD <= 3500) return { bracket: "2,501–3,500", feeLabel: "US$375", feeValue: 375 };
  if (salaryUSD <= 5000) return { bracket: "3,501–5,000", feeLabel: "US$500", feeValue: 500 };
  return { bracket: "≥ 5,001", feeLabel: "12% del monto", feeValue: Math.round(salaryUSD * 0.12), feePercent: 12 };
}

type EmploymentType = "full-time" | "part-time" | "services-agreement" | "one-off" | "consulting";
type LocationType = "remote" | "on_site" | "hybrid";

function normalizeEmploymentType(v: string | null | undefined): EmploymentType {
  const raw = (v ?? "").toLowerCase().trim();
  if (raw === "full-time" || raw === "full_time") return "full-time";
  if (raw === "part-time" || raw === "part_time") return "part-time";
  if (raw === "services-agreement" || raw === "service-agreement" || raw === "services" || raw === "contract") return "services-agreement";
  if (raw === "one-off" || raw === "puntual") return "one-off";
  if (raw === "consulting" || raw === "consultoria" || raw === "consultoría") return "consulting";
  return "full-time";
}
function normalizeLocationType(v: string | null | undefined): LocationType {
  const raw = (v ?? "").toLowerCase().trim();
  if (raw === "remote") return "remote";
  if (raw === "on_site" || raw === "onsite" || raw === "on-site") return "on_site";
  if (raw === "hybrid") return "hybrid";
  return "remote";
}

type FormState = {
  companyId?: string;
  title: string;
  description: string;
  employmentType: string;
  locationType: string;
  location?: string | null;
  salary?: number | null;
  currency?: string | null;
};

type CompanyLite = { id: string; name: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function norm(v: unknown) {
  return typeof v === "string" ? v.trim().toLowerCase() : "";
}
function isCompanyAdminFrom(me: any, profile: any) {
  const candidates: string[] = [];
  if (me?.role) candidates.push(norm(me.role));
  if (me?.user?.role) candidates.push(norm(me.user.role));
  if (profile?.role) candidates.push(norm(profile.role));
  const arrays: any[] = [me?.roles, me?.user?.roles, me?.claims?.roles, profile?.roles, profile?.permissions, me?.permissions];
  for (const arr of arrays) {
    if (Array.isArray(arr)) for (const r of arr) candidates.push(norm(r));
  }
  const flags = [
    me?.is_company_admin,
    profile?.is_company_admin,
    profile?.company_admin,
    me?.user?.is_company_admin,
    profile?.isCompanyAdmin,
    me?.isCompanyAdmin,
  ].some(Boolean);
  const aliases = new Set(["company_admin", "companyadmin", "employer", "company-owner", "company_owner", "org_admin", "employer_admin"]);
  const hit = candidates.some((r) => aliases.has(r));
  return flags || hit;
}
function pickMyCompany(arr: any[], userId: string): CompanyLite | null {
  if (!Array.isArray(arr) || !userId) return null;
  const mine = arr.find((it) => String(it?.adminId ?? it?.admin_id ?? "") === userId) ?? null;
  if (mine?.id) return { id: String(mine.id), name: String(mine.name ?? "Mi empresa") };
  return null;
}

export default function Client() {
  const router = useRouter();

  const [isCompanyAdmin, setIsCompanyAdmin] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [authErr, setAuthErr] = useState<string | null>(null);
  const [adminCompany, setAdminCompany] = useState<CompanyLite | null>(null);
  const [companyLoading, setCompanyLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setAuthLoading(true);
        const meRes = await fetch("/api/me", { credentials: "include", cache: "no-store" });
        const me = await meRes.json().catch(() => null);
        const id: string | null = me?.id ?? me?.user?.id ?? null;
        if (!id) {
          setIsCompanyAdmin(false);
          setAuthErr("No autenticado");
          return;
        }
        setUserId(id);
        let profile: any = null;
        try {
          const pRes = await fetch(`/api/profiles?ids=${encodeURIComponent(id)}`, { credentials: "include", cache: "no-store" });
          const pdata = await pRes.json().catch(() => null);
          profile = Array.isArray(pdata?.profiles) ? pdata.profiles[0] ?? null : null;
        } catch {
          profile = null;
        }
        const flag = isCompanyAdminFrom(me, profile);
        setIsCompanyAdmin(Boolean(flag));
        if (!flag) setAuthErr("Solo los usuarios con rol 'company_admin' pueden crear ofertas laborales.");
      } catch {
        setAuthErr("No autenticado");
      } finally {
        setAuthLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      setCompanyLoading(true);
      try {
        const cRes = await fetch(`/api/company/byAdmin?id=${encodeURIComponent(userId)}`, {
          method: "GET",
          headers: { Accept: "application/json" },
          credentials: "include",
          cache: "no-store",
        });
        if (cRes.ok) {
          const cjson = await cRes.json().catch(() => null);
          const arr = Array.isArray(cjson) ? cjson : Array.isArray(cjson?.items) ? cjson.items : (cjson ? [cjson] : []);
          const mine = pickMyCompany(arr, userId);
          setAdminCompany(mine);
          if (mine) {
            setIsCompanyAdmin(true);
            setAuthErr(null);
          }
        } else {
          setAdminCompany(null);
        }
      } catch {
        setAdminCompany(null);
      } finally {
        setCompanyLoading(false);
      }
    })();
  }, [userId]);

  const [form, setForm] = useState<FormState>({
    companyId: "",
    title: "",
    description: "",
    employmentType: "full-time",
    locationType: "remote",
    location: "",
    salary: undefined,
    currency: "USD",
  });

  useEffect(() => {
    if (adminCompany?.id && UUID_RE.test(adminCompany.id)) setForm((f) => ({ ...f, companyId: adminCompany.id }));
  }, [adminCompany?.id]);

  const [skillsText, setSkillsText] = useState<string>("");
  const [requirementsText, setRequirementsText] = useState<string>("");

  const [salaryInput, setSalaryInput] = useState<string>("");
  const salaryNumber = useMemo(() => Number(salaryInput || 0), [salaryInput]);
  const fee = useMemo(() => computeCmeFeeUSD(salaryNumber), [salaryNumber]);

  const onChange =
    (key: keyof FormState) =>
      (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const value = e.currentTarget.type === "number" ? (e.currentTarget as HTMLInputElement).valueAsNumber : e.currentTarget.value;
        setForm((f) => ({ ...f, [key]: (key === "salary" ? Number(value) : value) as any }));
        if (key === "salary") setSalaryInput(String(value ?? ""));
      };

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<any | null>(null);
  const [showModal, setShowModal] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreated(null);

    if (!isCompanyAdmin) {
      setError("No tienes permisos para crear ofertas.");
      return;
    }
    if (companyLoading) {
      setError("Estamos validando tu empresa…");
      return;
    }
    if (!adminCompany?.id) {
      setError("Aún no tienes una empresa asociada. Crea tu empresa para poder publicar ofertas.");
      return;
    }

    const companyId = (adminCompany.id || "").trim();
    const titleTrim = (form.title || "").trim();
    const descTrim = (form.description || "").trim();

    if (!UUID_RE.test(companyId)) {
      setError("El ID de tu empresa no es un UUID válido.");
      return;
    }
    if (!titleTrim) {
      setError("El campo 'title' es obligatorio");
      return;
    }
    if (!descTrim) {
      setError("El campo 'description' es obligatorio");
      return;
    }

    if (!isFinite(salaryNumber) || salaryNumber <= 0) {
      setError("Indica el monto de la posición: con él se calcula el fee de contratación.");
      return;
    }

    const employmentType = normalizeEmploymentType(form.employmentType);
    const locationType = normalizeLocationType(form.locationType);

    const skills = (skillsText || "").split(",").map((s) => s.trim()).filter(Boolean);
    const requirements = (requirementsText || "").split(/\r?\n/).map((s) => s.trim()).filter(Boolean).join("\n") || undefined;

    const payload = {
      companyId,
      title: titleTrim,
      description: descTrim,
      employmentType,
      locationType,
      location: (form.location || "").trim() || null,
      salary: isFinite(salaryNumber) && salaryNumber > 0 ? salaryNumber : null,
      currency: (form.currency || "USD").trim() || "USD",
      requirements: requirements ?? null,
      skills: skills.length ? skills : null
    };

    setLoading(true);
    try {
      const res = await fetch("/api/jobs/create", { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const txt = await res.text();
      let json: any = null;
      try { json = txt ? JSON.parse(txt) : null; } catch { }
      if (!res.ok || !json?.id) throw new Error(json?.message || `HTTP ${res.status}`);
      setCreated(json);
      setShowModal(true);
    } catch (err: any) {
      setError(err?.message || "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  function handleModalAccept() {
    setShowModal(false);
    if (created?.id) router.push(`/jobs/${created.id}`);
    else router.push("/");
  }

  return (
    <div className={styles.page}>
      <div className={styles.main}>
        <div className={styles.formCard}>
          <h2 className={styles.title}>Crear oferta laboral</h2>
          <p className={styles.subtitle}>Publica una vacante y visualiza la tarifa estimada según el salario.</p>

          {authLoading ? (
            <div className={styles.statusNote}>Cargando…</div>
          ) : authErr && !isCompanyAdmin ? (
            <div className={styles.statusError}>{authErr}</div>
          ) : companyLoading ? (
            <div className={styles.statusNote}>Validando tu empresa…</div>
          ) : !adminCompany?.id ? (
            <div className={styles.statusError}>
              No tienes una empresa asociada todavía <Link className={styles.secundaryBtn} href="/createCompany">Crear empresa</Link>
            </div>
          ) : (
            <div className={styles.statusOk}>
              Publicarás como <b>{adminCompany.name}</b> <small style={{ opacity: .7 }}>({adminCompany.id})</small>.
            </div>
          )}

          <form onSubmit={handleSubmit} className={styles.formGrid} aria-disabled={!isCompanyAdmin}>
            <div className={styles.formField}>
              <label className={styles.label}>Cargo / Título *</label>
              <input
                className={styles.input}
                placeholder="Ej: Desarrollador Full Stack"
                value={form.title}
                onChange={onChange("title")}
                required
                disabled={!isCompanyAdmin || loading}
              />
            </div>

            <div className={styles.formFieldFull}>
              <label className={styles.label}>Descripción *</label>
              <textarea
                className={styles.textarea}
                placeholder="Describe las funciones, responsabilidades y el stack."
                rows={6}
                value={form.description}
                onChange={onChange("description")}
                required
                disabled={!isCompanyAdmin || loading}
              />
            </div>

            <div className={styles.twoCols}>
              <div className={styles.formField}>
                <label className={styles.label}>Tipo de contratación</label>
                <select
                  className={styles.input}
                  value={form.employmentType}
                  onChange={onChange("employmentType")}
                  disabled={!isCompanyAdmin || loading}
                >
                  <option value="full-time">Tiempo completo</option>
                  <option value="part-time">Medio tiempo</option>
                  <option value="services-agreement">Contrato de servicios</option>
                  <option value="one-off">Trabajo puntual</option>
                  <option value="consulting">Consultoría</option>
                </select>
              </div>

              <div className={styles.formField}>
                <label className={styles.label}>Modalidad</label>
                <select
                  className={styles.input}
                  value={form.locationType}
                  onChange={onChange("locationType")}
                  disabled={!isCompanyAdmin || loading}
                >
                  <option value="remote">Remoto</option>
                  <option value="on_site">Presencial</option>
                  <option value="hybrid">Híbrido</option>
                </select>
              </div>
            </div>

            <div className={styles.formField}>
              <label className={styles.label}>Ubicación</label>
              <input
                className={styles.input}
                placeholder="Ciudad, País"
                value={form.location || ""}
                onChange={onChange("location")}
                disabled={!isCompanyAdmin || loading}
              />
            </div>

            <div className={styles.formField}>
              <label className={styles.label}>Salario (USD)</label>
              <input
                className={styles.input}
                inputMode="decimal"
                placeholder="Ej: 2500"
                value={salaryInput}
                onChange={(e) => {
                  const clean = e.target.value.replace(/[^\d.]/g, "");
                  setSalaryInput(clean);
                  setForm((f) => ({ ...f, salary: clean ? Number(clean) : undefined }));
                }}
                disabled={!isCompanyAdmin || loading}
              />
              <div className={styles.helperRow}>
                <span className={styles.helperText}>
                  <b>Tarifa CME:</b> {fee.feeLabel} <span className={styles.dimmed}>(rango: {fee.bracket}{fee.feePercent ? ` • ${fee.feePercent}%` : ""})</span>
                </span>
              </div>
            </div>

            <div className={styles.formFieldFull}>
              <label className={styles.label}>Habilidades (separadas por coma)</label>
              <input
                className={styles.input}
                placeholder="React, Node, PostgreSQL"
                value={skillsText}
                onChange={(e) => setSkillsText(e.target.value)}
                disabled={!isCompanyAdmin || loading}
              />
            </div>

            <div className={styles.formFieldFull}>
              <label className={styles.label}>Requisitos (uno por línea)</label>
              <textarea
                className={styles.textarea}
                placeholder={`• 3+ años en React\n• Inglés intermedio`}
                rows={4}
                value={requirementsText}
                onChange={(e) => setRequirementsText(e.target.value)}
                disabled={!isCompanyAdmin || loading}
              />
            </div>

            {error && <div className={styles.statusError}>{error}</div>}
            {created && !showModal && (
              <div className={styles.statusOk}>
                <b>Oferta creada:</b> {created.title} (ID: {created.id})
              </div>
            )}

            <div className={styles.actions}>
              <button className={styles.primaryBtn} disabled={loading || !isCompanyAdmin} type="submit">
                {loading ? "Creando…" : "Crear oferta"}
              </button>
              <button
                className={styles.secundaryBtn}
                type="button"
                disabled={loading}
                onClick={() => {
                  setForm({
                    companyId: adminCompany?.id ?? "",
                    title: "",
                    description: "",
                    employmentType: "full-time",
                    locationType: "remote",
                    location: "",
                    salary: undefined,
                    currency: "USD",
                  });
                  setSkillsText("");
                  setRequirementsText("");
                  setError(null);
                  setCreated(null);
                  setSalaryInput("");
                }}
              >
                Limpiar
              </button>
            </div>
          </form>
        </div>
      </div>

      {showModal && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true">
          <div className={styles.modalCard}>
            <h3 className={styles.modalTitle}>¡Oferta creada!</h3>
            <p className={styles.modalBody}>
              {created?.title ? <>La oferta <b>{created.title}</b> se creó correctamente.</> : "La oferta se creó correctamente."}
            </p>
            <div className={styles.modalActions}>
              <button className={styles.primaryBtn} onClick={handleModalAccept}>
                Ver oferta
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
