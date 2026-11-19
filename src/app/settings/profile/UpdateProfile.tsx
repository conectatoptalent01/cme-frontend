// src/app/settings/profile/UpdateProfile.tsx
"use client";
import React, { useEffect, useMemo, useState } from "react";
import styles from "./updateProfile.module.css";
import { PropagateLoader } from "react-spinners";
import { safeNextPath } from "../../../../lib/safe-next";

type ExperienceItem = { role?: string; company?: string; start?: string; end?: string; description?: string };
type EducationItem = { degree?: string; institution?: string; start?: string; end?: string; description?: string };
type UploadKind = "avatar" | "cover" | "cv";

const reE164 = /^\+[1-9]\d{7,14}$/;

/** "6123-4567" → "+50761234567"; si ya trae "+" o código de país, se respeta. */
function normalizePhoneInput(v: string, defaultCc = "507"): string {
  const raw = v.trim();
  if (!raw) return "";
  let d = raw.replace(/[^\d+]/g, "");
  if (d.startsWith("00")) d = "+" + d.slice(2);
  if (d.startsWith("+")) return "+" + d.slice(1).replace(/\D/g, "");
  const only = d.replace(/\D/g, "");
  return only.length <= 8 ? `+${defaultCc}${only}` : `+${only}`;
}
const reYYYYMM = /^\d{4}-(0[1-9]|1[0-2])$/;

function compareYYYYMM(a: string, b: string) {
  const [ya, ma] = a.split("-").map(Number);
  const [yb, mb] = b.split("-").map(Number);
  return ya * 100 + ma - (yb * 100 + mb);
}

const hasContent = (obj: Record<string, unknown>) => Object.values(obj).some((v) => typeof v === "string" && v.trim() !== "");

function normalizeList<T extends Record<string, unknown>>(list: T[] | null | undefined): T[] | undefined {
  if (!Array.isArray(list)) return undefined;
  const cleaned = list
    .map((it) => {
      const out: Record<string, any> = {};
      for (const [k, v] of Object.entries(it)) {
        if (typeof v === "string") {
          const t = v.trim();
          if (t !== "") out[k] = t;
        }
      }
      return out;
    })
    .filter((it) => hasContent(it)) as T[];
  return cleaned.length ? cleaned : undefined;
}

const belongsToMe = (url: string | null | undefined, me: string | null) => {
  if (!url || !me) return true;
  const m = url.match(/\/users\/([0-9a-f-]{36})\//i);
  return !m || m[1] === me;
};

async function j<T = any>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, { credentials: "include", cache: "no-store", ...init });
  const raw = await res.text().catch(() => "");
  let data: any = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch { }
  if (!res.ok) {
    const msg = data?.error || data?.message || raw || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return (data ?? null) as T;
}

async function uploadOneShot(kind: UploadKind, file: File) {
  const fd = new FormData();
  fd.append("file", file, file.name);
  const res = await fetch(`/api/uploads/self/${kind}`, { method: "POST", credentials: "include", body: fd });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.error || (json?.message && (Array.isArray(json.message) ? json.message.join(", ") : json.message)) || `Fallo subiendo ${kind} (${res.status})`;
    throw new Error(msg);
  }
  return json as { url: string; bucket: string; path: string };
}

async function apiGetMe(): Promise<{ id?: string; user?: { id?: string } } | null> {
  try {
    const me = await j<{ id?: string; user?: { id?: string } }>("/api/me");
    return me;
  } catch {
    return null;
  }
}

type ProfileDTO = {
  id: string;
  email?: string | null;
  full_name?: string | null;
  profile_picture?: string | null;
  cover_photo?: string | null;
  occupation?: string | null;
  skills?: string[] | null;
  role?: string | null;
  phone?: string | null;
  about_me?: string | null;
  experience?: ExperienceItem[] | null;
  education?: EducationItem[] | null;
  cv_url?: string | null;
};

async function apiGetMyProfile(userId?: string | null) {
  try {
    const r = await j<{ profile?: ProfileDTO } | ProfileDTO>("/api/profiles/me");
    const p = (r as any)?.profile ?? r;
    if (p?.id) return p as ProfileDTO;
  } catch { }
  if (userId) {
    try {
      const r = await j<{ profile?: ProfileDTO } | ProfileDTO>(`/api/profiles/${encodeURIComponent(userId)}`);
      const p = (r as any)?.profile ?? r;
      if (p?.id) return p as ProfileDTO;
    } catch { }
  }
  throw new Error("No se pudo cargar tu perfil.");
}

type UpdatePayload = {
  fullName?: string;
  occupation?: string;
  skills?: string[];
  profilePicture?: string | null;
  coverPhoto?: string | null;
  cvUrl?: string | null;
  phone?: string;
  aboutMe?: string;
  experience?: ExperienceItem[];
  education?: EducationItem[];
  documentType?: "cedula" | "passport";
  documentId?: string;
};

async function apiPatchMyProfile(payload: UpdatePayload) {
  const res = await fetch("/api/profile/update", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.ok === false) {
    throw new Error(json?.error || `profile_update_failed (${res.status})`);
  }
  return json;
}

export default function UpdateProfile() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [meId, setMeId] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [occupation, setOccupation] = useState("");
  const [skillsStr, setSkillsStr] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [cvUrl, setCvUrl] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [documentType, setDocumentType] = useState<"cedula" | "passport">("cedula");
  const [documentId, setDocumentId] = useState("");
  // ?completar=1 → viene de aceptar una invitación: pedimos teléfono, documento y CV.
  const completing = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("completar") === "1";
  const [aboutMe, setAboutMe] = useState("");
  const [experience, setExperience] = useState<ExperienceItem[]>([]);
  const [education, setEducation] = useState<EducationItem[]>([]);
  const [expPresent, setExpPresent] = useState<boolean[]>([]);
  const [eduPresent, setEduPresent] = useState<boolean[]>([]);
  const [expRowErrors, setExpRowErrors] = useState<string[]>([]);
  const [eduRowErrors, setEduRowErrors] = useState<string[]>([]);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [cvFile, setCvFile] = useState<File | null>(null);

  const avatarPreview = useMemo(() => (avatarFile ? URL.createObjectURL(avatarFile) : avatarUrl || undefined), [avatarFile, avatarUrl]);
  const coverPreview = useMemo(() => (coverFile ? URL.createObjectURL(coverFile) : coverUrl || undefined), [coverFile, coverUrl]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setFormError(null);
        setOk(null);
        const me = await apiGetMe();
        const userId = me?.id || me?.user?.id || null;
        if (!userId) throw new Error("No autenticado");
        setMeId(userId);
        const p = await apiGetMyProfile(userId);
        setFullName(p?.full_name ?? "");
        setOccupation(p?.occupation ?? "");
        setSkillsStr(Array.isArray(p?.skills) ? p.skills.join(", ") : "");
        setAvatarUrl(p?.profile_picture ?? null);
        setCoverUrl(p?.cover_photo ?? null);
        setCvUrl(p?.cv_url ?? null);
        setPhone(p?.phone ?? "");
        setDocumentType((p as any)?.document_type === "passport" ? "passport" : "cedula");
        setDocumentId((p as any)?.document_id ?? "");
        setAboutMe(p?.about_me ?? "");
        const expList: ExperienceItem[] = Array.isArray(p?.experience) ? (p.experience as any) : [];
        const eduList: EducationItem[] = Array.isArray(p?.education) ? (p.education as any) : [];
        setExperience(expList);
        setEducation(eduList);
        setExpPresent(expList.map((it) => (it.end ?? "").toLowerCase() === "present"));
        setEduPresent(eduList.map((it) => (it.end ?? "").toLowerCase() === "present"));
        setExpRowErrors(expList.map(() => ""));
        setEduRowErrors(eduList.map(() => ""));
      } catch (e: any) {
        setFormError(e?.message ?? "Error");
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      try {
        if (avatarPreview?.startsWith("blob:")) URL.revokeObjectURL(avatarPreview);
        if (coverPreview?.startsWith("blob:")) URL.revokeObjectURL(coverPreview);
      } catch { }
    };
  }, []);

  const addExp = () => {
    setExperience((xs) => [...xs, { role: "", company: "", start: "", end: "", description: "" }]);
    setExpPresent((xs) => [...xs, false]);
    setExpRowErrors((xs) => [...xs, ""]);
  };
  const delExp = (i: number) => {
    setExperience((xs) => xs.filter((_, j) => j !== i));
    setExpPresent((xs) => xs.filter((_, j) => j !== i));
    setExpRowErrors((xs) => xs.filter((_, j) => j !== i));
  };
  const updExp = (i: number, patch: Partial<ExperienceItem>) => {
    setExperience((xs) => xs.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  };

  const addEdu = () => {
    setEducation((xs) => [...xs, { degree: "", institution: "", start: "", end: "", description: "" }]);
    setEduPresent((xs) => [...xs, false]);
    setEduRowErrors((xs) => [...xs, ""]);
  };
  const delEdu = (i: number) => {
    setEducation((xs) => xs.filter((_, j) => j !== i));
    setEduPresent((xs) => xs.filter((_, j) => j !== i));
    setEduRowErrors((xs) => xs.filter((_, j) => j !== i));
  };
  const updEdu = (i: number, patch: Partial<EducationItem>) => {
    setEducation((xs) => xs.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  };

  const toggleExpPresent = (i: number) => {
    setExpPresent((prev) => {
      const nx = [...prev];
      const presentNext = !nx[i];
      nx[i] = presentNext;
      setExperience((exp) => exp.map((x, j) => (j === i ? { ...x, end: presentNext ? "present" : "" } : x)));
      return nx;
    });
  };
  const toggleEduPresent = (i: number) => {
    setEduPresent((prev) => {
      const nx = [...prev];
      const presentNext = !nx[i];
      nx[i] = presentNext;
      setEducation((edu) => edu.map((x, j) => (j === i ? { ...x, end: presentNext ? "present" : "" } : x)));
      return nx;
    });
  };

  function validateRows() {
    const expErrs = experience.map(() => "");
    const eduErrs = education.map(() => "");
    experience.forEach((it, i) => {
      const s = (it.start ?? "").trim();
      const e = (it.end ?? "").trim();
      if (s && !reYYYYMM.test(s)) {
        expErrs[i] = "“Inicio” debe ser YYYY-MM.";
      } else if (e && !(reYYYYMM.test(e) || /^present$/i.test(e))) {
        expErrs[i] = "“Fin” debe ser YYYY-MM o present.";
      } else if (reYYYYMM.test(s) && reYYYYMM.test(e) && compareYYYYMM(s, e) > 0) {
        expErrs[i] = "“Inicio” no puede ser posterior a “Fin”.";
      }
    });
    education.forEach((it, i) => {
      const s = (it.start ?? "").trim();
      const e = (it.end ?? "").trim();
      if (s && !reYYYYMM.test(s)) {
        eduErrs[i] = "“Inicio” debe ser YYYY-MM.";
      } else if (e && !(reYYYYMM.test(e) || /^present$/i.test(e))) {
        eduErrs[i] = "“Fin” debe ser YYYY-MM o present.";
      } else if (reYYYYMM.test(s) && reYYYYMM.test(e) && compareYYYYMM(s, e) > 0) {
        eduErrs[i] = "“Inicio” no puede ser posterior a “Fin”.";
      }
    });
    setExpRowErrors(expErrs);
    setEduRowErrors(eduErrs);
    const hasAny = [...expErrs, ...eduErrs].some(Boolean);
    return !hasAny;
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    setOk(null);
    try {
      if (!meId) throw new Error("No autenticado");
      const phoneNorm = normalizePhoneInput(phone);
      if (phoneNorm && !reE164.test(phoneNorm)) {
        setFormError("Revisa el teléfono. Ejemplos válidos: 6123-4567 o +507 6123 4567.");
        setSaving(false);
        return;
      }
      if (documentId.trim().length > 30) {
        setFormError("El número de documento es demasiado largo.");
        setSaving(false);
        return;
      }
      if (completing) {
        const missing = [
          !fullName.trim() && "nombre completo",
          !phoneNorm && "teléfono",
          !documentId.trim() && (documentType === "passport" ? "pasaporte" : "cédula"),
          !cvUrl && !cvFile && "CV en PDF",
        ].filter(Boolean);
        if (missing.length) {
          setFormError(`Para terminar tu postulación falta: ${missing.join(", ")}.`);
          setSaving(false);
          return;
        }
      }
      if (!validateRows()) {
        setFormError("Corrige los campos indicados.");
        setSaving(false);
        return;
      }
      let newCoverUrl: string | null = coverUrl;
      let newAvatarUrl: string | null = avatarUrl;
      let newCvUrl: string | null = cvUrl;
      if (coverFile) {
        const up = await uploadOneShot("cover", coverFile);
        newCoverUrl = up.url;
      }
      if (avatarFile) {
        const up = await uploadOneShot("avatar", avatarFile);
        newAvatarUrl = up.url;
      }
      if (cvFile) {
        if (!/\.pdf$/i.test(cvFile.name)) {
          setFormError("El CV debe ser un archivo PDF.");
          setSaving(false);
          return;
        }
        const up = await uploadOneShot("cv", cvFile);
        newCvUrl = up.url;
      }
      if (newAvatarUrl && !belongsToMe(newAvatarUrl, meId)) newAvatarUrl = null;
      if (newCoverUrl && !belongsToMe(newCoverUrl, meId)) newCoverUrl = null;
      if (newCvUrl && !belongsToMe(newCvUrl, meId)) newCvUrl = null;
      const skillsArr = skillsStr ? skillsStr.split(",").map((s) => s.trim()).filter(Boolean) : undefined;
      const expClean = normalizeList<ExperienceItem>(experience);
      const eduClean = normalizeList<EducationItem>(education);
      const payload: UpdatePayload = {
        fullName: fullName || undefined,
        occupation: occupation || undefined,
        skills: skillsArr,
        profilePicture: newAvatarUrl ?? null,
        coverPhoto: newCoverUrl ?? null,
        cvUrl: newCvUrl ?? null,
        phone: phoneNorm || undefined,
        aboutMe: aboutMe || undefined,
        documentType: documentId.trim() ? documentType : undefined,
        documentId: documentId.trim() || undefined,
        experience: expClean,
        education: eduClean,
      };
      await apiPatchMyProfile(payload);
      setAvatarUrl(newAvatarUrl ?? null);
      setCoverUrl(newCoverUrl ?? null);
      setCvUrl(newCvUrl ?? null);
      setAvatarFile(null);
      setCoverFile(null);
      setCvFile(null);
      setPhone(phoneNorm);
      setOk("Perfil actualizado correctamente.");
      if (completing) {
        const next = safeNextPath(new URLSearchParams(window.location.search).get("next"), "/applications");
        window.location.assign(next);
      }
    } catch (e: any) {
      setFormError(e?.message || "No se pudo actualizar el perfil. Intenta nuevamente.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className={styles.loading}><PropagateLoader /></div> as any;

  return (
    <>
      <header className={styles.header}>
        <h3 className={styles.title}>{completing ? "Completa tu perfil" : "Editar mi perfil"}</h3>
        <p className={styles.sub}>
          {completing
            ? "Aceptaste la recomendación. Para terminar tu postulación agrega tu teléfono, tu cédula o pasaporte y tu CV en PDF."
            : "Actualiza tu información básica, imágenes y CV."}
        </p>
      </header>
      <form onSubmit={onSubmit} className={styles.form} noValidate>
        <div className={styles.coverBox}>
          {coverPreview ? <img src={coverPreview} alt="Cover" className={styles.coverImg} /> : <div className={styles.coverPlaceholder}>Imagen de portada</div>}
          <label className={styles.coverBtn}>
            Cambiar portada
            <input type="file" accept="image/*" className={styles.file} onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)} />
          </label>
        </div>
        <div className={styles.avatarRow}>
          <div className={styles.avatarWrap}>
            {avatarPreview ? <img src={avatarPreview} alt="Avatar" className={styles.avatar} /> : <div className={styles.avatarFallback} />}
          </div>
          <label className={styles.avatarBtn}>
            Cambiar avatar
            <input type="file" accept="image/*" className={styles.file} onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)} />
          </label>
          <span className={styles.hint}>PNG/JPG recomendado 512x512+</span>
        </div>
        <div className={styles.grid}>
          <div className={styles.field}>
            <label className={styles.label}>Nombre completo</label>
            <input className={styles.input} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Tu nombre" />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Ocupación</label>
            <input className={styles.input} value={occupation} onChange={(e) => setOccupation(e.target.value)} placeholder="Software Engineer" />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Teléfono</label>
            <input className={styles.input} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="6123-4567 o +507 6123 4567" inputMode="tel" />
            <small className={styles.hint}>Si no pones código de país, asumimos Panamá (+507).</small>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Documento de identidad</label>
            <div style={{ display: "flex", gap: 8 }}>
              <select
                className={styles.input}
                style={{ maxWidth: 140 }}
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value === "passport" ? "passport" : "cedula")}
              >
                <option value="cedula">Cédula</option>
                <option value="passport">Pasaporte</option>
              </select>
              <input
                className={styles.input}
                value={documentId}
                onChange={(e) => setDocumentId(e.target.value)}
                placeholder={documentType === "passport" ? "Número de pasaporte" : "8-123-4567"}
                maxLength={30}
              />
            </div>
            <small className={styles.hint}>Solo lo ves tú. No se muestra en tu perfil público.</small>
          </div>
          <div className={styles.fieldWide}>
            <label className={styles.label}>Skills (separadas por coma)</label>
            <input className={styles.input} value={skillsStr} onChange={(e) => setSkillsStr(e.target.value)} placeholder="React, NestJS, PostgreSQL" />
          </div>
          <div className={styles.fieldWide}>
            <label className={styles.label}>Sobre mí</label>
            <textarea className={styles.textarea} rows={4} value={aboutMe} onChange={(e) => setAboutMe(e.target.value)} placeholder="Resumen breve de tu perfil" />
          </div>
        </div>
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h4>Experiencia</h4>
            <button type="button" className={styles.smallBtn} onClick={addExp}>+ Añadir</button>
          </div>
          {experience.length === 0 && <p className={styles.muted}>Sin registros</p>}
          {experience.map((item, i) => {
            const present = expPresent[i] ?? false;
            const rowErr = expRowErrors[i] ?? "";
            return (
              <div className={styles.card} key={`exp-${i}`}>
                <div className={styles.cardRow}>
                  <input className={styles.input} placeholder="Cargo" value={item.role ?? ""} onChange={(e) => updExp(i, { role: e.target.value })} />
                  <input className={styles.input} placeholder="Empresa" value={item.company ?? ""} onChange={(e) => updExp(i, { company: e.target.value })} />
                </div>
                <div className={styles.cardRow}>
                  <div className={styles.fieldInline}>
                    <label className={styles.smallLabel}>Inicio</label>
                    <input type="month" className={styles.input} value={item.start ?? ""} onChange={(e) => { updExp(i, { start: e.target.value }); }} />
                  </div>
                  <div className={styles.fieldInline}>
                    <label className={styles.smallLabel}>Fin</label>
                    <input type="month" className={styles.input} value={present ? "" : (reYYYYMM.test(item.end ?? "") ? (item.end ?? "") : "")} disabled={present} onChange={(e) => { updExp(i, { end: e.target.value }); }} />
                    <label className={styles.checkboxRow}>
                      <input type="checkbox" checked={present} onChange={() => toggleExpPresent(i)} />
                      Actualmente trabajo aquí
                    </label>
                  </div>
                </div>
                <textarea className={styles.textarea} rows={3} placeholder="Descripción" value={item.description ?? ""} onChange={(e) => updExp(i, { description: e.target.value })} />
                {rowErr && <div className={styles.rowError}>{rowErr}</div>}
                <div className={styles.rowRight}>
                  <button type="button" className={styles.dangerBtn} onClick={() => delExp(i)}>Eliminar</button>
                </div>
              </div>
            );
          })}
        </section>
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h4>Educación</h4>
            <button type="button" className={styles.smallBtn} onClick={addEdu}>+ Añadir</button>
          </div>
          {education.length === 0 && <p className={styles.muted}>Sin registros</p>}
          {education.map((item, i) => {
            const present = eduPresent[i] ?? false;
            const rowErr = eduRowErrors[i] ?? "";
            return (
              <div className={styles.card} key={`edu-${i}`}>
                <div className={styles.cardRow}>
                  <input className={styles.input} placeholder="Título/Grado" value={item.degree ?? ""} onChange={(e) => updEdu(i, { degree: e.target.value })} />
                  <input className={styles.input} placeholder="Institución" value={item.institution ?? ""} onChange={(e) => updEdu(i, { institution: e.target.value })} />
                </div>
                <div className={styles.cardRow}>
                  <div className={styles.fieldInline}>
                    <label className={styles.smallLabel}>Inicio</label>
                    <input type="month" className={styles.input} value={item.start ?? ""} onChange={(e) => updEdu(i, { start: e.target.value })} />
                  </div>
                  <div className={styles.fieldInline}>
                    <label className={styles.smallLabel}>Fin</label>
                    <input type="month" className={styles.input} value={present ? "" : (reYYYYMM.test(item.end ?? "") ? (item.end ?? "") : "")} disabled={present} onChange={(e) => updEdu(i, { end: e.target.value })} />
                    <label className={styles.checkboxRow}>
                      <input type="checkbox" checked={present} onChange={() => toggleEduPresent(i)} />
                      Aún cursando
                    </label>
                  </div>
                </div>
                <textarea className={styles.textarea} rows={3} placeholder="Descripción" value={item.description ?? ""} onChange={(e) => updEdu(i, { description: e.target.value })} />
                {rowErr && <div className={styles.rowError}>{rowErr}</div>}
                <div className={styles.rowRight}>
                  <button type="button" className={styles.dangerBtn} onClick={() => delEdu(i)}>Eliminar</button>
                </div>
              </div>
            );
          })}
        </section>
        {formError && <div className={styles.error} role="alert">{formError}</div>}
        {ok && <div className={styles.ok} role="status">{ok}</div>}
        <div className={styles.actions}>
          <button type="submit" className={styles.primaryBtn} disabled={saving}>{saving ? "Guardando…" : "Guardar cambios"}</button>
          <button type="button" className={styles.secondaryBtn} disabled={saving} onClick={() => { setAvatarFile(null); setCoverFile(null); setCvFile(null); setOk(null); setFormError(null); }}>Cancelar</button>
        </div>
      </form>
    </>
  );
}
