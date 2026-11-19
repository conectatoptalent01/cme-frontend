'use client';

import React, { useEffect, useMemo, useState } from 'react';
import styles from './active.module.css';
import { PropagateLoader } from 'react-spinners';
import { employmentTypeLabel } from "../../../../lib/employment-type";

type Referral = {
    id: string;
    headhunter_id: string;
    candidate_id: string | null;
    job_offer_id: string;
    referral_code: string | null;
    status: string;
    created_at: string;
    updated_at: string | null;
    // invitación por WhatsApp pendiente (se borran al aceptar, rechazar o vencer)
    invitee_first_name?: string | null;
    invitee_last_name?: string | null;
    invite_expires_at?: string | null;
};

type JobMin = {
    id: string;
    company_id: string;
    title: string | null;
    location?: string | null;
    employment_type?: string | null;
    status?: string | null;
    created_at?: string | null;
};

type CompanyMin = {
    id: string;
    name: string | null;
    location?: string | null;
    city?: string | null;
    profilePicture?: string | null;
    profile_picture?: string | null;
    logoUrl?: string | null;
    logo_url?: string | null;
    logo?: string | null;
    avatar?: string | null;
};

type ProfileLite = {
    id: string;
    full_name?: string | null;
    email?: string | null;
    phone?: string | null;
    profile_picture?: string | null;
};

async function j<T = any>(input: RequestInfo, init?: RequestInit): Promise<T> {
    const res = await fetch(input, { credentials: 'include', cache: 'no-store', ...init });
    const raw = await res.text();
    let data: any = null;
    try { data = raw ? JSON.parse(raw) : null; } catch { }
    if (!res.ok) {
        const msg = data?.error || data?.message || raw || `HTTP ${res.status}`;
        throw new Error(msg);
    }
    return data as T;
}

function getDefaultMonth(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
}

function getMonthRange(ym: string): { from: number; to: number } | null {
    const m = /^(\d{4})-(\d{2})$/.exec(ym);
    if (!m) return null;
    const y = Number(m[1]);
    const mon = Number(m[2]);
    if (mon < 1 || mon > 12) return null;
    const from = new Date(y, mon - 1, 1, 0, 0, 0, 0).getTime();
    const to = new Date(y, mon, 0, 23, 59, 59, 999).getTime();
    return { from, to };
}

function humanStatus(s?: string) {
    const map: Record<string, string> = {
        submitted: 'Enviado',
        accepted_by_candidate: 'Aceptado por candidato',
        declined_by_candidate: 'Rechazado por candidato',
        reviewing: 'En revisión',
        rejected: 'Rechazado',
        shortlist: 'Shortlist',
        hired: 'Contratado',
        expired: 'Venció sin respuesta',
    };
    const k = (s || '').toLowerCase();
    return map[k] ?? (s || '—');
}

function statusClass(s?: string, css?: any) {
    switch ((s || '').toLowerCase()) {
        case 'hired': return css.pillOk;
        case 'rejected':
        case 'declined_by_candidate': return css.pillWarn;
        default: return css.pillMuted;
    }
}

function waLink(phone?: string | null, text?: string) {
    const msg = text || 'Hola, te referí a una vacante.';
    const digits = (phone || '').replace(/\D/g, '');
    if (digits) return `https://wa.me/${digits}?text=${encodeURIComponent(msg)}`;
    return `https://wa.me/?text=${encodeURIComponent(msg)}`;
}

function initials(name?: string | null) {
    if (!name) return '•';
    const parts = name.trim().split(/\s+/).slice(0, 2);
    return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '•';
}

function companyLogo(c?: CompanyMin | null): string | null {
    if (!c) return null;
    return (
        c?.profilePicture ??
        c?.profile_picture ??
        c?.logoUrl ??
        c?.logo_url ??
        c?.logo ??
        c?.avatar ??
        null
    );
}

export default function MyReferralsPage() {
    const [month] = useState<string>(getDefaultMonth());
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);
    const [items, setItems] = useState<Referral[]>([]);
    const [profiles, setProfiles] = useState<Record<string, ProfileLite>>({});
    const [companiesById, setCompaniesById] = useState<Record<string, CompanyMin>>({});
    const [jobsById, setJobsById] = useState<Record<string, JobMin>>({});

    const monthRange = useMemo(() => getMonthRange(month), [month]);

    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                setLoading(true);
                setErr(null);

                const me = await j<{ id?: string; user?: { id?: string } }>('/api/me');
                const headhunterId = me?.id || me?.user?.id;
                if (!headhunterId) throw new Error('No autenticado');

                const qs = new URLSearchParams();
                if (monthRange) {
                    qs.set('from', String(monthRange.from));
                    qs.set('to', String(monthRange.to));
                }

                const refData = await j<any>(`/api/referrals/active${qs.toString() ? `?${qs.toString()}` : ''}`);
                const refs: Referral[] = Array.isArray(refData) ? refData : refData?.items ?? refData ?? [];

                const jobIds = Array.from(new Set(refs.map((x) => x.job_offer_id).filter(Boolean)));
                const jobsMap: Record<string, JobMin> = {};
                const companiesMap: Record<string, CompanyMin> = {};

                await Promise.all(
                    jobIds.map(async (jid) => {
                        try {
                            const jd = await j<{ job: JobMin | null; company: CompanyMin | null }>(`/api/jobs/${encodeURIComponent(jid)}`);
                            const job = jd?.job ?? null;
                            const inlineCompany = jd?.company ?? null;
                            if (job) jobsMap[jid] = job;

                            if (inlineCompany?.id) {
                                companiesMap[inlineCompany.id] = inlineCompany;
                                return;
                            }
                            const cid = job?.company_id;
                            if (!cid) return;

                            try {
                                const up = await j<any>(`/api/company/${encodeURIComponent(cid)}`);
                                const c = (up?.company ?? up?.data ?? up) as CompanyMin | null;
                                if (c?.id) companiesMap[c.id] = c;
                            } catch {
                                try {
                                    const up2 = await j<any>(`/api/company/${encodeURIComponent(cid)}`);
                                    const c2 = (up2?.company ?? up2?.data ?? up2) as CompanyMin | null;
                                    if (c2?.id) companiesMap[c2.id] = c2;
                                } catch { }
                            }
                        } catch { }
                    })
                );

                const candIds = Array.from(new Set(refs.map((x) => x.candidate_id).filter(Boolean))) as string[];
                const profilesMap: Record<string, ProfileLite> = {};
                if (candIds.length) {
                    let loaded = false;

                    try {
                        const r1 = await fetch(`/api/profiles/batch`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ ids: candIds }),
                            credentials: 'include',
                        });
                        if (r1.ok) {
                            const j1 = await r1.json();
                            const arr: ProfileLite[] = j1?.profiles ?? j1 ?? [];
                            for (const p of arr) profilesMap[p.id] = p;
                            loaded = true;
                        }
                    } catch { }

                    if (!loaded) {
                        try {
                            const q = encodeURIComponent(candIds.join(','));
                            const r0 = await fetch(`/api/profiles?ids=${q}`, {
                                method: 'GET',
                                credentials: 'include',
                            });
                            if (r0.ok) {
                                const j0 = await r0.json();
                                const arr: ProfileLite[] = j0?.profiles ?? j0 ?? [];
                                for (const p of arr) profilesMap[p.id] = p;
                            }
                        } catch { }
                    }
                }

                if (!alive) return;
                setItems(refs);
                setJobsById(jobsMap);
                setCompaniesById(companiesMap);
                setProfiles(profilesMap);
            } catch (e: any) {
                if (!alive) return;
                setErr(e?.message || 'No se pudo cargar tus referencias');
            } finally {
                if (alive) setLoading(false);
            }
        })();
        return () => { alive = false; };
    }, [monthRange]);

    const filtered = useMemo(() => {
        if (!monthRange) return items;
        const { from, to } = monthRange;
        const out = items.filter((r) => {
            const t = new Date(r.created_at).getTime();
            return t >= from && t <= to;
        });
        return out.length ? out : items;
    }, [items, monthRange]);

    return (
        <div className={styles.page}>
            <div className={styles.main}>
                <header className={styles.pageHeader}>
                    <h1 className={styles.title}>Mis referencias</h1>
                    <p className={styles.subtitle}>Revisa el estado de tus referidos y contáctalos rápido.</p>
                </header>

                {loading ? (
                    <div className={styles.loading}><PropagateLoader /></div>
                ) : err ? (
                    <div className={styles.error}>Error: {err}</div>
                ) : filtered.length === 0 ? (
                    <div className={styles.empty}>Aún no tienes referencias.</div>
                ) : (
                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>Referencias ({filtered.length})</h2>
                        <ul className={styles.list}>
                            {filtered.map((r) => {
                                const job = jobsById[r.job_offer_id];
                                const company = job?.company_id ? companiesById[job.company_id] : undefined;
                                const prof = r.candidate_id ? profiles[r.candidate_id] : undefined;

                                const emailHref = prof?.email ? `mailto:${prof.email}` : undefined;
                                const chatHref = waLink(prof?.phone, 'Hola, te referí a una vacante.');
                                const logo = companyLogo(company);

                                return (
                                    <li className={styles.card} key={r.id}>
                                        <div className={styles.media}>
                                            {logo ? (
                                                <img className={styles.avatarImg} src={logo} alt={company?.name ?? 'Empresa'} loading="lazy" />
                                            ) : (
                                                <div className={styles.avatarFallback}>{initials(company?.name)}</div>
                                            )}
                                        </div>

                                        <div className={styles.content}>
                                            <div className={styles.rowTop}>
                                                <div className={styles.companyBlock}>
                                                    <div className={styles.companyName}>{company?.name ?? 'Empresa'}</div>
                                                    <div className={styles.companySub}>{company?.location ?? company?.city ?? '—'}</div>
                                                </div>
                                                <span className={`${styles.pill} ${statusClass(r.status, styles)}`}>{humanStatus(r.status)}</span>
                                            </div>

                                            <div className={styles.jobBlock}>
                                                <div className={styles.jobTitle}>{job?.title ?? 'Oferta'}</div>
                                                <div className={styles.jobMeta}>
                                                    <span>{job?.location ?? '—'}</span>
                                                    <span>•</span>
                                                    <span>{employmentTypeLabel(job?.employment_type)}</span>
                                                    <span>•</span>
                                                    <span className={`${styles.pill} ${styles.pillInfo}`}>{job?.status ?? '—'}</span>
                                                </div>
                                            </div>

                                            <div className={styles.rowBottom}>
                                                <div className={styles.metaRow}>
                                                    <span className={styles.metaLabel}>Referido</span>
                                                    <span>
                                                        {prof?.full_name
                                                            ?? (r.invitee_first_name
                                                                ? `${r.invitee_first_name} ${r.invitee_last_name ?? ''} · invitación pendiente${r.invite_expires_at ? ` (vence ${new Date(r.invite_expires_at).toLocaleDateString('es-PA', { day: 'numeric', month: 'short' })})` : ''}`
                                                                : (r.candidate_id ? `ID ${r.candidate_id.slice(0, 8)}…` : '—'))}
                                                    </span>
                                                </div>

                                                <div className={styles.metaRow}>
                                                    <span className={styles.metaLabel}>Código</span>
                                                    <span className={styles.mono}>{r.referral_code ?? '—'}</span>
                                                </div>

                                                <div className={styles.metaRow} style={{ gap: 12 }}>
                                                    {emailHref ? <a className={styles.link} href={emailHref}>Email</a> : <span className={styles.mono} style={{ opacity: 0.6 }}>Email no disponible</span>}
                                                    <span>•</span>
                                                    <a className={styles.link} href={chatHref} target="_blank" rel="noopener noreferrer">Chatear</a>
                                                </div>

                                                <span className={styles.date}>Creado el {new Date(r.created_at).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    </section>
                )}
            </div>
        </div>
    );
}
