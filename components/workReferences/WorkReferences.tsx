"use client";

import React, { useEffect, useState } from "react";
import { backend } from "../../lib/backend";
import styles from "./workReferences.module.css";

type Ref = {
  id: string;
  reference_name: string;
  company_name: string;
  relationship: string;
  status: "pending" | "confirmed" | "declined" | "expired";
  reference_comment: string | null;
  expires_at: string;
  resolved_at: string | null;
  created_at: string;
};

type Created = Ref & {
  confirmUrl: string;
  shareText: string;
  whatsapp: { mode: "simulated" | "meta"; status: "simulated" | "sent" | "failed"; to: string };
};

const MAX = 3;
const STATUS: Record<Ref["status"], { label: string; cls: string }> = {
  pending: { label: "Esperando confirmación", cls: "pending" },
  confirmed: { label: "Confirmada", cls: "ok" },
  declined: { label: "No confirmada", cls: "bad" },
  expired: { label: "Venció sin respuesta", cls: "bad" },
};
const ERRORS: Record<string, string> = {
  invalid_phone: "Revisa el teléfono. Ejemplos: 6123-4567 o +57 300 123 4567.",
  reference_cannot_be_yourself: "La referencia no puede ser tu propio teléfono.",
  max_references_reached: "Ya tienes 3 referencias vigentes.",
};

const fmt = (iso: string) => new Date(iso).toLocaleDateString("es-PA", { day: "numeric", month: "long" });

/**
 * Referencias laborales del candidato: hasta 3 ex jefes o ex empleadores que confirman por WhatsApp.
 * Las confirmadas las ven las empresas donde el candidato postuló.
 */
export default function WorkReferences() {
  const [items, setItems] = useState<Ref[] | null>(null);
  const [form, setForm] = useState({ referenceName: "", companyName: "", relationship: "", phone: "" });
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Created | null>(null);
  const [lastPhone, setLastPhone] = useState("");

  async function load() {
    try { setItems(await backend<Ref[]>("work-references/mine")); } catch { setItems([]); }
  }
  useEffect(() => { load(); }, []);

  const active = (items ?? []).filter((r) => r.status === "pending" || r.status === "confirmed").length;

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (Object.values(form).some((v) => !v.trim())) { setError("Completa los cuatro campos."); return; }
    setBusy(true);
    try {
      const r = await backend<Created>("work-references", { method: "POST", body: form });
      setCreated(r);
      setLastPhone(form.phone);
      setForm({ referenceName: "", companyName: "", relationship: "", phone: "" });
      setOpen(false);
      await load();
    } catch (e: any) {
      setError(ERRORS[e?.message] || "No se pudo agregar la referencia. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("¿Quitar esta referencia? El enlace que le enviaste dejará de funcionar.")) return;
    try { await backend(`work-references/${id}`, { method: "DELETE" }); await load(); } catch { }
  }

  function shareFromMyWhatsApp(c: Created, phone?: string) {
    const digits = (phone ?? "").replace(/\D/g, "");
    const to = digits ? (digits.length <= 8 ? `507${digits}` : digits) : "";
    window.open(`https://wa.me/${to}?text=${encodeURIComponent(c.shareText)}`, "_blank", "noopener,noreferrer");
  }

  return (
    <section className={styles.wrap}>
      <h3 className={styles.title}>Referencias laborales</h3>
      <p className={styles.sub}>
        Agrega hasta {MAX} personas que hayan sido tus jefes o empleadores. Les pediremos por WhatsApp que confirmen
        tu referencia. Las confirmadas las verán las empresas donde postules; su teléfono nunca se muestra.
      </p>

      {created && (
        <div className={styles.notice}>
          {created.whatsapp.status === "sent" ? (
            <p>Le enviamos el pedido de confirmación por WhatsApp a <b>{created.reference_name}</b>.</p>
          ) : (
            <>
              <p>
                Referencia agregada. {created.whatsapp.status === "simulated"
                  ? "El envío automático por WhatsApp todavía no está activo: envíale tú el pedido."
                  : "No pudimos enviarlo automáticamente: envíale tú el pedido."}
              </p>
              <div className={styles.row}>
                <button className={styles.wpp} onClick={() => shareFromMyWhatsApp(created, lastPhone)}>Enviar desde mi WhatsApp</button>
                <button className={styles.secondary} onClick={() => navigator.clipboard?.writeText(created.confirmUrl)}>Copiar enlace</button>
              </div>
            </>
          )}
        </div>
      )}

      {items === null ? (
        <p className={styles.muted}>Cargando…</p>
      ) : items.length === 0 ? (
        <p className={styles.muted}>Aún no agregaste referencias.</p>
      ) : (
        <ul className={styles.list}>
          {items.map((r) => (
            <li key={r.id} className={styles.item}>
              <div>
                <div className={styles.name}>{r.reference_name}</div>
                <div className={styles.muted}>{r.relationship} · {r.company_name}</div>
                {r.status === "confirmed" && r.reference_comment && <p className={styles.comment}>“{r.reference_comment}”</p>}
                {r.status === "pending" && <div className={styles.muted}>El enlace vence el {fmt(r.expires_at)}.</div>}
              </div>
              <div className={styles.side}>
                <span className={`${styles.pill} ${styles[STATUS[r.status].cls]}`}>{STATUS[r.status].label}</span>
                {r.status === "pending" && (
                  <button className={styles.link} onClick={() => remove(r.id)}>Quitar</button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {active < MAX && !open && (
        <button className={styles.primary} onClick={() => { setOpen(true); setCreated(null); }}>
          + Agregar referencia
        </button>
      )}

      {open && (
        <form className={styles.form} onSubmit={add} noValidate>
          <label>Nombre y apellido
            <input value={form.referenceName} maxLength={120} placeholder="Ej: Carlos Ruiz"
              onChange={(e) => setForm({ ...form, referenceName: e.target.value })} />
          </label>
          <label>Empresa donde trabajaron juntos
            <input value={form.companyName} maxLength={120} placeholder="Ej: Banco General"
              onChange={(e) => setForm({ ...form, companyName: e.target.value })} />
          </label>
          <label>¿Qué era esta persona para ti?
            <input value={form.relationship} maxLength={120} placeholder="Ej: Jefe directo, Gerente de área"
              onChange={(e) => setForm({ ...form, relationship: e.target.value })} />
          </label>
          <label>Su WhatsApp
            <input value={form.phone} inputMode="tel" placeholder="6123-4567 o +57 300 123 4567"
              onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </label>
          {error && <p className={styles.error}>{error}</p>}
          <div className={styles.row}>
            <button type="button" className={styles.secondary} onClick={() => setOpen(false)} disabled={busy}>Cancelar</button>
            <button type="submit" className={styles.primary} disabled={busy}>{busy ? "Enviando…" : "Pedir confirmación"}</button>
          </div>
        </form>
      )}
    </section>
  );
}
