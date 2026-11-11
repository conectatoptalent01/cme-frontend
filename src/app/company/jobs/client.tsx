'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import styles from './companyJobs.module.css';
import Link from 'next/link';
import { PropagateLoader } from 'react-spinners';

const FEE_COP = 10000;

type FeeQuote = { bracket: string; feeLabel: string; feeValue: number; feePercent?: number };
function computeCmeFeeUSD(salaryUSD: number): FeeQuote {
    if (!salaryUSD || salaryUSD <= 0) return { bracket: '—', feeLabel: '—', feeValue: 0 };
    if (salaryUSD <= 1000) return { bracket: '≤ 1,000', feeLabel: 'US$150', feeValue: 150 };
    if (salaryUSD <= 2500) return { bracket: '1,001–2,500', feeLabel: 'US$250', feeValue: 250 };
    if (salaryUSD <= 3500) return { bracket: '2,501–3,500', feeLabel: 'US$375', feeValue: 375 };
    if (salaryUSD <= 5000) return { bracket: '3,501–5,000', feeLabel: 'US$500', feeValue: 500 };
    return { bracket: '≥ 5,001', feeLabel: '12% del monto', feeValue: Math.round(salaryUSD * 0.12), feePercent: 12 };
}

async function restJson<T = any>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, {
        credentials: 'include',
        cache: 'no-store',
        headers: { Accept: 'application/json', ...(init?.headers || {}) },
        ...init,
    });
    const text = await res.text();
    let json: any = null;
    try { json = text ? JSON.parse(text) : null; } catch { throw new Error(`${url} devolvió no-JSON: ${text.slice(0, 180)}`); }
    if (!res.ok) {
        const msg = json?.error || json?.message || `HTTP ${res.status}`;
        throw new Error(msg);
    }
    return json as T;
}

type AuthMe = { id: string; email?: string | null; role?: string | null };
type Company = { id: string; name: string; profilePicture?: string | null; location?: string | null };

type JobItem = {
    id: string;
    title: string;
    status?: string | null;
    created_at?: string | null;
    company_id: string;
    location?: string | null;
    employment_type?: string | null;
    salary?: number | null;
    currency?: string | null;
};

type ReferralRow = {
    id: string;
    status?: string | null;
    created_at?: string | null;
    referral_code?: string | null;
    candidate_id?: string | null;
    headhunter_id: string;
    job_offer_id: string;
};

const LINEAR_FLOW: string[] = ['accepted_by_candidate', 'reviewing', 'shortlist', 'hired'];

const TERMINALS = {
    declined_by_candidate: 'declined_by_candidate',
    rejected: 'rejected',
} as const;

function humanStatus(s?: string | null) {
    if (!s) return '—';
    const map: Record<string, string> = { draft: 'Borrador', open: 'Abierta', paused: 'Pausada', closed: 'Cerrada' };
    return map[s] ?? s;
}

function humanReferralStatus(s?: string | null) {
    const map: Record<string, string> = {
        submitted: 'Enviado',
        accepted_by_candidate: 'Aceptado por el candidato',
        reviewing: 'En revisión',
        shortlist: 'Shortlist',
        hired: 'Contratado',
        rejected: 'Rechazado',
        declined_by_candidate: 'Rechazado por el candidato',
    };
    return s ? (map[s] ?? s) : '—';
}

function formatMoney(currency: string, amount: number) {
    const cur = (currency || 'USD').toUpperCase();
    try {
        const opts: Intl.NumberFormatOptions = { style: 'currency', currency: cur };
        if (cur === 'COP') opts.maximumFractionDigits = 0;
        return new Intl.NumberFormat('es-CO', opts).format(amount);
    } catch {
        return `${amount} ${cur}`;
    }
}

async function createNotificationForCandidate(p: { candidateId: string; jobTitle: string; newStatus: string; jobId?: string; }) {
    const { candidateId, jobTitle, newStatus, jobId } = p;
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRe.test(candidateId)) return;
    const rawTitle = `Actualización en tu proceso para "${jobTitle}"`;
    const rawMessage = `El estado de tu referencia ha cambiado a: ${humanReferralStatus(newStatus)}.`;
    const body = { userId: candidateId, title: rawTitle.slice(0, 180), message: rawMessage.slice(0, 5000), notificationType: 'recommendation', channel: 'system', relatedId: jobId ?? undefined };
    try { await restJson('/api/notifications', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); } catch { }
}

async function createNotificationForHeadhunter(p: { headhunterId: string; candidateName: string; jobTitle: string; newStatus: string; jobId?: string; }) {
    const { headhunterId, candidateName, jobTitle, newStatus, jobId } = p;
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRe.test(headhunterId)) return;
    const who = candidateName?.trim() ? candidateName.trim() : 'el candidato que referiste';
    const rawTitle = `Tu referido en "${jobTitle}" cambió de estado`;
    const rawMessage = `${who} fue puesto en estado: ${humanReferralStatus(newStatus)}.`;
    const body = { userId: headhunterId, title: rawTitle.slice(0, 180), message: rawMessage.slice(0, 5000), notificationType: 'recommendation', channel: 'system', relatedId: jobId ?? undefined };
    try { await restJson('/api/notifications', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); } catch { }
}

type PayStatus = 'idle' | 'creating' | 'waiting' | 'approved' | 'rejected' | 'error';
type PayDbStatus = 'idle' | 'saving' | 'ok' | 'failed';

export default function Client() {
    const [auth, setAuth] = useState<AuthMe | null>(null);
    const [company, setCompany] = useState<Company | null>(null);
    const [rows, setRows] = useState<JobItem[]>([]);
    const [total, setTotal] = useState(0);
    const [limit, setLimit] = useState(20);
    const [offset, setOffset] = useState(0);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);

    const isCompanyAdmin = (auth?.role ?? '').toLowerCase() === 'company_admin';

    const [modalOpen, setModalOpen] = useState(false);
    const [modalJob, setModalJob] = useState<JobItem | null>(null);
    const [modalLoading, setModalLoading] = useState(false);
    const [modalError, setModalError] = useState<string | null>(null);
    const [modalRefs, setModalRefs] = useState<ReferralRow[]>([]);
    const [modalPage, setModalPage] = useState(1);
    const MODAL_LIMIT = 10;

    const [expandedReferralId, setExpandedReferralId] = useState<string | null>(null);
    const [savingReferralId, setSavingReferralId] = useState<string | null>(null);

    const [payOpen, setPayOpen] = useState(false);
    const [payStatus, setPayStatus] = useState<PayStatus>('idle');
    const [payPrefId, setPayPrefId] = useState<string | null>(null);
    const [payPaymentId, setPayPaymentId] = useState<string | null>(null);
    const [payError, setPayError] = useState<string | null>(null);
    const [payForReferral, setPayForReferral] = useState<ReferralRow | null>(null);
    const [payForJob, setPayForJob] = useState<JobItem | null>(null);
    const [payDbStatus, setPayDbStatus] = useState<PayDbStatus>('idle');

    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const companyRef = useRef<Company | null>(null);
    const payForReferralRef = useRef<ReferralRow | null>(null);
    const payForJobRef = useRef<JobItem | null>(null);
    const candMapRef = useRef<Record<string, { name?: string | null; photo?: string | null }>>({});

    const [candidateMap, setCandidateMap] = useState<Record<string, { name?: string | null; photo?: string | null }>>({});

    useEffect(() => { companyRef.current = company; }, [company]);
    useEffect(() => { payForReferralRef.current = payForReferral; }, [payForReferral]);
    useEffect(() => { payForJobRef.current = payForJob; }, [payForJob]);
    useEffect(() => { candMapRef.current = candidateMap; }, [candidateMap]);

    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                setLoading(true);
                setErr(null);
                const me = await restJson<{ id: string; role?: string | null; user?: any; error?: string }>('/api/me');
                const userId = me?.id ?? me?.user?.id;
                const role = (me?.user?.role ?? me?.role ?? '').toString().toLowerCase();
                if (!userId) throw new Error('No autenticado');
                if (role !== 'company_admin') throw new Error("Solo los usuarios con rol 'company_admin' pueden ver sus ofertas.");
                setAuth({ id: userId, role });

                // OBTENER EMPRESA POR /api/company/byAdmin?id=USER_ID (misma forma que en Navbar)
                const byAdmin = await restJson<any>(`/api/company/byAdmin?id=${encodeURIComponent(userId)}`);
                const arr = Array.isArray(byAdmin) ? byAdmin : (Array.isArray(byAdmin?.items) ? byAdmin.items : (byAdmin ? [byAdmin] : []));
                const comp = arr[0] ?? null;
                if (!comp?.id) throw new Error('No tienes una empresa asociada aún.');
                setCompany(comp);
            } catch (e: any) {
                if (!alive) return;
                setErr(e?.message || 'No autorizado');
            } finally {
                if (alive) setLoading(false);
            }
        })();
        return () => { alive = false; };
    }, []);

    useEffect(() => {
        let alive = true;
        if (!company?.id || !isCompanyAdmin) return;
        (async () => {
            try {
                setLoading(true);
                setErr(null);
                const qs = new URLSearchParams({ companyId: company.id, limit: String(limit), offset: String(offset) }).toString();
                const resp = await restJson<{ total?: number; items?: JobItem[] } | JobItem[]>(`/api/jobs/search?${qs}`);
                const items = Array.isArray(resp) ? resp : (Array.isArray((resp as any)?.items) ? (resp as any).items : []);
                const totalVal = typeof (resp as any)?.total === 'number' ? (resp as any).total : items.length;
                if (!alive) return;
                setRows(items);
                setTotal(totalVal);
            } catch (e: any) {
                if (!alive) return;
                setErr(e?.message || 'No se pudieron cargar las ofertas');
                setRows([]);
                setTotal(0);
            } finally {
                if (alive) setLoading(false);
            }
        })();
        return () => { alive = false; };
    }, [company?.id, isCompanyAdmin, limit, offset]);

    const page = useMemo(() => Math.floor(offset / limit) + 1, [offset, limit]);
    const totalPages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total, limit]);

    const canPrev = offset > 0;
    const canNext = offset + limit < total;

    function getFeeForJob(job?: JobItem | null): { amount: number; currency: string; label: string } {
        if (job?.salary && (job.currency ?? '').toUpperCase() === 'USD') {
            const q = computeCmeFeeUSD(job.salary);
            return { amount: q.feeValue, currency: 'USD', label: q.feeLabel };
        }
        return { amount: FEE_COP, currency: 'COP', label: formatMoney('COP', FEE_COP) };
    }

    function openReferralsModal(job: JobItem) {
        setModalJob(job);
        setModalOpen(true);
        setModalError(null);
        setModalRefs([]);
        setModalPage(1);
        setExpandedReferralId(null);
    }

    function closeReferralsModal() {
        setModalOpen(false);
        setModalJob(null);
        setModalRefs([]);
        setModalError(null);
        setModalPage(1);
        setExpandedReferralId(null);
    }

    function modalGoToPage(p: number) {
        if (!modalJob) return;
        setExpandedReferralId(null);
        setModalPage(p);
    }

    useEffect(() => {
        if (!modalOpen || !modalJob?.id) return;
        let alive = true;
        const currentJobId = modalJob.id;
        const newOffset = (modalPage - 1) * MODAL_LIMIT;
        (async () => {
            try {
                setModalLoading(true);
                setModalError(null);
                let list: ReferralRow[] = [];
                try {
                    const qs = new URLSearchParams({ jobOfferId: currentJobId, limit: String(MODAL_LIMIT), offset: String(newOffset) }).toString();
                    const r = await restJson<{ items?: ReferralRow[] } | ReferralRow[]>(`/api/referrals?${qs}`);
                    list = Array.isArray(r) ? r : (Array.isArray(r?.items) ? r.items : []);
                } catch {
                    const r2 = await restJson<{ items?: ReferralRow[] } | ReferralRow[]>(`/api/referrals/search`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jobOfferId: currentJobId, limit: MODAL_LIMIT, offset: newOffset }) });
                    list = Array.isArray(r2) ? r2 : (Array.isArray(r2?.items) ? r2.items : []);
                }
                list = (list || []).filter(r => (r.status ?? '').toLowerCase() !== 'submitted');
                list = list.filter(r => (r.job_offer_id ?? '') === currentJobId);
                if (!alive) return;
                if (currentJobId !== modalJob.id) return;
                setModalRefs(list);
            } catch (e: any) {
                if (!alive) return;
                setModalError(e?.message || 'No se pudieron cargar los referidos');
                setModalRefs([]);
            } finally {
                if (alive) setModalLoading(false);
            }
        })();
        return () => { alive = false; };
    }, [modalOpen, modalJob?.id, modalPage]);

    useEffect(() => {
        const ids = Array.from(new Set((modalRefs || []).map(r => r.candidate_id).filter(Boolean))) as string[];
        if (!ids.length) { setCandidateMap({}); return; }
        let alive = true;
        (async () => {
            try {
                const key = encodeURIComponent(ids.join(','));
                const res = await restJson<{ profiles?: any[] }>(`/api/profiles?ids=${key}`);
                const arr = Array.isArray(res?.profiles) ? res.profiles : [];
                const map: Record<string, { name?: string | null; photo?: string | null }> = {};
                for (const p of arr) {
                    const first = p.first_name ?? p.firstName ?? p.given_name ?? p.givenName ?? null;
                    const last = p.last_name ?? p.lastName ?? p.family_name ?? p.familyName ?? null;
                    const joined = [first, last].filter(Boolean).join(' ').trim() || null;
                    const emailLocal = typeof p.email === 'string' && p.email.includes('@') ? p.email.split('@')[0] : null;
                    const name = p.full_name ?? p.fullName ?? p.name ?? joined ?? p.username ?? emailLocal ?? null;
                    const photo = p.profile_picture ?? p.profilePicture ?? p.avatar ?? p.photo ?? null;
                    if (p.id) map[p.id] = { name, photo };
                }
                if (!alive) return;
                setCandidateMap(map);
            } catch {
                setCandidateMap({});
            }
        })();
        return () => { alive = false; };
    }, [modalRefs]);

    function linearIndex(status?: string | null) {
        const i = LINEAR_FLOW.indexOf((status ?? '').toLowerCase());
        return i < 0 ? 0 : i;
    }
    function isTerminal(status?: string | null) {
        const v = (status ?? '').toLowerCase();
        return v === TERMINALS.declined_by_candidate || v === TERMINALS.rejected;
    }

    function openPayModal(refRow: ReferralRow, job: JobItem) {
        setPayForReferral(refRow);
        setPayForJob(job);
        setPayOpen(true);
        setPayStatus('idle');
        setPayPrefId(null);
        setPayPaymentId(null);
        setPayDbStatus('idle');
        setPayError(null);
    }

    function closePayModal() {
        setPayOpen(false);
        setPayForReferral(null);
        setPayForJob(null);
        setPayPrefId(null);
        setPayPaymentId(null);
        setPayStatus('idle');
        setPayDbStatus('idle');
        setPayError(null);
        if (pollRef.current) clearInterval(pollRef.current);
    }

    /**
     * El backend confirma el pago con el webhook de la pasarela: registra el pago,
     * marca el referido como Contratado y crea la comisión del reclutador.
     * Aquí solo se refleja en pantalla y se avisa a los involucrados.
     */
    async function onPaymentApproved() {
        setPayStatus('approved');
        setPayDbStatus('ok');
        const freshReferral = payForReferralRef.current;
        const freshJob = payForJobRef.current;
        if (!freshReferral || !freshJob) return;

        setModalRefs(prev => prev.map(r => r.id === freshReferral.id ? { ...r, status: 'hired' } : r));

        const candId = freshReferral.candidate_id || undefined;
        const candName = candId ? (candMapRef.current[candId]?.name || '') : '';
        try {
            if (candId && freshJob?.title) {
                await createNotificationForCandidate({ candidateId: candId, jobTitle: freshJob.title, newStatus: 'hired', jobId: freshJob.id });
            }
            if (freshReferral.headhunter_id && freshJob?.title) {
                await createNotificationForHeadhunter({ headhunterId: freshReferral.headhunter_id, candidateName: candName, jobTitle: freshJob.title, newStatus: 'hired', jobId: freshJob.id });
            }
        } catch { }
    }

    /** Consulta nuestro registro del pago (no la pasarela) hasta que el webhook lo confirme. */
    function startPolling(paymentId: string) {
        if (pollRef.current) clearInterval(pollRef.current);
        const startedAt = Date.now();
        pollRef.current = setInterval(async () => {
            try {
                const p = await restJson<{ status?: string }>(`/api/payments/${encodeURIComponent(paymentId)}`);
                const st = String(p?.status ?? '').toLowerCase();
                if (st === 'succeeded') {
                    if (pollRef.current) clearInterval(pollRef.current);
                    await onPaymentApproved();
                } else if (st === 'failed') {
                    if (pollRef.current) clearInterval(pollRef.current);
                    setPayStatus('rejected');
                } else if (Date.now() - startedAt > 30 * 60 * 1000) {
                    if (pollRef.current) clearInterval(pollRef.current);
                    setPayStatus('error');
                    setPayError('Aún no recibimos la confirmación del pago. Revisa el estado más tarde en Finanzas.');
                } else {
                    setPayStatus('waiting');
                }
            } catch { }
        }, 4000);
    }

    /** Solo se envía el referido: el monto lo calcula el backend con la tabla de tarifas. */
    async function beginPayment() {
        try {
            setPayError(null);
            setPayStatus('creating');
            const referral = payForReferralRef.current ?? payForReferral;
            if (!referral) {
                setPayStatus('error');
                setPayError('No se encontró el referido a contratar.');
                return;
            }
            const data = await restJson<{ checkoutUrl?: string; paymentId?: string }>('/api/payments/checkout', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ referralId: referral.id }),
            });
            if (!data?.checkoutUrl || !data?.paymentId) {
                setPayStatus('error');
                setPayError('No se pudo iniciar el pago.');
                return;
            }
            setPayPaymentId(data.paymentId);
            setPayStatus('waiting');
            window.open(data.checkoutUrl, '_blank', 'noopener,noreferrer');
            startPolling(data.paymentId);
        } catch (e: any) {
            setPayStatus('error');
            const msg = String(e?.message || '');
            setPayError(
                msg.includes('job_salary_required')
                    ? 'La vacante no tiene monto de la posición; agrégalo para calcular el fee.'
                    : msg || 'Error iniciando el pago'
            );
        }
    }

    async function setReferralStatus(referralId: string, newStatus: string, candidateId?: string) {
        try {
            if (newStatus.toLowerCase() === 'hired') {
                const ref = modalRefs.find(r => r.id === referralId);
                if (!ref || !modalJob) return;
                openPayModal(ref, modalJob);
                return;
            }
            setSavingReferralId(referralId);
            const prev = modalRefs.find(r => r.id === referralId)?.status;
            const refRow = modalRefs.find(r => r.id === referralId) || null;
            setModalRefs(prevList => prevList.map(r => r.id === referralId ? { ...r, status: newStatus } : r));
            const res = await fetch(`/api/referrals/${encodeURIComponent(referralId)}`, {
                method: 'PATCH',
                headers: { 'content-type': 'application/json', accept: 'application/json' },
                credentials: 'include',
                cache: 'no-store',
                body: JSON.stringify({ status: newStatus }),
            });
            const ct = res.headers.get('content-type') || '';
            const txt = await res.text();
            const json = ct.includes('application/json') ? (txt ? JSON.parse(txt) : null) : null;
            if (!res.ok) {
                const msg = json?.error || json?.message || `HTTP ${res.status}`;
                setModalRefs(prevList => prevList.map(r => r.id === referralId ? { ...r, status: prev ?? r.status } : r));
                throw new Error(msg);
            }
            try {
                const idForNotify = candidateId ?? refRow?.candidate_id ?? null;
                const candName = idForNotify ? (candidateMap[idForNotify]?.name || '') : '';
                if (idForNotify && modalJob?.title) {
                    await createNotificationForCandidate({ candidateId: idForNotify, jobTitle: modalJob.title, newStatus, jobId: modalJob.id });
                }
                if (refRow?.headhunter_id && modalJob?.title) {
                    await createNotificationForHeadhunter({ headhunterId: refRow.headhunter_id, candidateName: candName, jobTitle: modalJob.title, newStatus, jobId: modalJob.id });
                }
            } catch { }
        } catch (e: any) {
            setModalError(e?.message || 'No se pudo actualizar el estado');
        } finally {
            setSavingReferralId(null);
        }
    }

    return (
        <div className={styles.main}>
            <header className={styles.pageHeader}>
                <div>
                    <h1 className={styles.title}>Mis ofertas</h1>
                    <p className={styles.subtitle}>
                        {company?.name ? <>Empresa: <b>{company.name}</b></> : '—'}
                    </p>
                </div>
                <div className={styles.headerActions}>
                    <Link className={styles.primaryBtn} href="/jobs/new">+ Nueva oferta</Link>
                </div>
            </header>

            {err && <div className={styles.error}>{err}</div>}

            {loading ? (
                <div className={styles.loading}>
                    <PropagateLoader />
                </div>
            ) : rows.length === 0 ? (
                <div className={styles.empty}>
                    Aún no has publicado ofertas.
                    <div style={{ marginTop: 12 }}>
                        <Link className={styles.primaryBtn} href="/jobs/new">Crear primera oferta</Link>
                    </div>
                </div>
            ) : (
                <>
                    <div className={styles.tableWrap}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>Título</th>
                                    <th>Modalidad</th>
                                    <th>Ubicación</th>
                                    <th>Salario</th>
                                    <th>Estado</th>
                                    <th>Creada</th>
                                    <th style={{ textAlign: 'right' }}>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map(job => (
                                    <tr key={job.id} className={styles.row}>
                                        <td className={styles.jobTitleCell}>
                                            <Link href={`/jobs/${job.id}`} className={styles.link}>{job.title}</Link>
                                        </td>
                                        <td>{job.employment_type ?? '—'}</td>
                                        <td>{job.location ?? '—'}</td>
                                        <td>{job.salary ? `${job.salary} ${job.currency ?? 'USD'}` : '—'}</td>
                                        <td><span className={`${styles.pill} ${pillClass(job.status, styles)}`}>{humanStatus(job.status)}</span></td>
                                        <td>{job.created_at ? new Date(job.created_at).toLocaleDateString() : '—'}</td>
                                        <td className={styles.actionsCell}>
                                            <button className={styles.secBtn} onClick={() => openReferralsModal(job)}>Ver referidos</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className={styles.pager}>
                        <button className={styles.pagerBtn} disabled={!canPrev} onClick={() => canPrev && setOffset(Math.max(0, offset - limit))}>← Anterior</button>
                        <span className={styles.pagerInfo}>Página {page} de {totalPages} • {total} resultados</span>
                        <button className={styles.pagerBtn} disabled={!canNext} onClick={() => canNext && setOffset(offset + limit)}>Siguiente →</button>
                        <div className={styles.pageSize}>
                            <label>
                                Mostrar
                                <select className={styles.pageSizeSelect} value={limit} onChange={(e) => { const n = Number(e.currentTarget.value) || 20; setLimit(n); setOffset(0); }}>
                                    <option value={10}>10</option>
                                    <option value={20}>20</option>
                                    <option value={50}>50</option>
                                </select>{' '}por página
                            </label>
                        </div>
                    </div>
                </>
            )}

            {modalOpen && (
                <div className={styles.modalOverlay} role="dialog" aria-modal="true" onClick={closeReferralsModal}>
                    <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <div className={styles.modalTitle}>{modalJob?.title ?? 'Referidos'}</div>
                            <button className={styles.modalClose} onClick={closeReferralsModal}>✕</button>
                        </div>

                        <div className={styles.modalBody}>
                            {modalError && <div className={styles.error}>{modalError}</div>}
                            {modalLoading ? (
                                <div className={styles.loading}><PropagateLoader /></div>
                            ) : modalRefs.length === 0 ? (
                                <div className={styles.empty}>Esta oferta no tiene referidos (aceptados) aún.</div>
                            ) : (
                                <ul className={styles.modalList}>
                                    {modalRefs.map((r) => {
                                        const v = (r.status ?? '').toLowerCase();
                                        const currentIdx = linearIndex(v);
                                        const terminal = isTerminal(v);
                                        const candId = r.candidate_id || '';
                                        const candName = candId ? (candidateMap[candId]?.name || '') : '';
                                        return (
                                            <li key={r.id} className={styles.modalItem}>
                                                <div className={styles.modalItemMain}>
                                                    <div className={styles.modalItemTitle}>
                                                        {candName ? candName : (candId ? `Candidato #${candId.slice(0, 8)}` : 'Candidato')}
                                                    </div>
                                                    <div className={styles.modalItemSub}>
                                                        Código: <span className={styles.mono}>{r.referral_code ?? '—'}</span>
                                                    </div>
                                                </div>

                                                <div className={styles.modalItemMeta}>
                                                    <span className={`${styles.pill} ${styles.pillInfo}`}>{humanReferralStatus(r.status)}</span>
                                                    <span className={styles.modalItemDate}>{r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}</span>
                                                </div>

                                                <div className={styles.modalItemActions}>
                                                    {r.candidate_id && (
                                                        <a className={styles.secBtn} href={`/profiles/users?id=${r.candidate_id}`} target="_blank" rel="noopener noreferrer">Perfil candidato</a>
                                                    )}
                                                    {r.headhunter_id && (
                                                        <a className={styles.secBtn} href={`/profiles/users?id=${r.headhunter_id}`} target="_blank" rel="noopener noreferrer">Ver referidor</a>
                                                    )}
                                                    <button className={styles.primaryBtn} onClick={() => setExpandedReferralId(expandedReferralId === r.id ? null : r.id)}>
                                                        {expandedReferralId === r.id ? 'Ocultar proceso' : 'Gestionar proceso'}
                                                    </button>
                                                </div>

                                                {expandedReferralId === r.id && (
                                                    <div className={styles.processPanel}>
                                                        <div className={styles.stepRow}>
                                                            {LINEAR_FLOW.map((step, idx) => {
                                                                const active = idx === currentIdx && !terminal;
                                                                const canClick = !terminal && idx === currentIdx + 1;
                                                                const isHiredStep = step === 'hired';
                                                                const disabled = terminal || (idx !== currentIdx && idx !== currentIdx + 1) || savingReferralId === r.id;
                                                                return (
                                                                    <button
                                                                        key={step}
                                                                        className={[styles.stepBtn, active ? styles.stepBtnActive : '', disabled ? styles.stepBtnDisabled : ''].join(' ')}
                                                                        disabled={disabled}
                                                                        title={humanReferralStatus(step)}
                                                                        onClick={() => {
                                                                            if (!canClick) return;
                                                                            if (isHiredStep) {
                                                                                openPayModal(r, modalJob!);
                                                                            } else {
                                                                                setReferralStatus(r.id, step, r.candidate_id || undefined);
                                                                            }
                                                                        }}
                                                                    >
                                                                        {humanReferralStatus(step)}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>

                                                        <div className={styles.dangerRow}>
                                                            <button
                                                                className={styles.dangerBtn}
                                                                disabled={savingReferralId === r.id || (r.status ?? '').toLowerCase() === 'hired' || terminal}
                                                                onClick={() => setReferralStatus(r.id, TERMINALS.rejected, r.candidate_id || undefined)}
                                                            >
                                                                Marcar “Rechazado”
                                                            </button>
                                                        </div>

                                                        {savingReferralId === r.id && <div className={styles.inlineSaving}>Guardando cambios…</div>}
                                                    </div>
                                                )}
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>

                        <div className={styles.modalFooter}>
                            <button className={styles.pagerBtn} onClick={() => modalPage > 1 && modalGoToPage(modalPage - 1)} disabled={modalPage <= 1 || modalLoading}>← Anterior</button>
                            <span className={styles.pagerInfo}>Página {modalPage}</span>
                            <button className={styles.pagerBtn} onClick={() => modalGoToPage(modalPage + 1)} disabled={modalLoading}>Siguiente →</button>
                        </div>
                    </div>
                </div>
            )}

            {payOpen && (
                <div className={styles.modalOverlay} role="dialog" aria-modal="true" style={{ zIndex: 9999, backdropFilter: 'blur(1px)' }} onClick={closePayModal}>
                    <div className={styles.modalCard} onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
                        <div className={styles.modalHeader}>
                            <div className={styles.modalTitle}>Confirmar contratación</div>
                            <button className={styles.modalClose} onClick={closePayModal}>✕</button>
                        </div>

                        <div className={styles.modalBody}>
                            {payStatus === 'idle' && (
                                <>
                                    <p style={{ marginBottom: 12 }}>Para marcar a este candidato como <b>Contratado</b>, la empresa debe pagar un fee.</p>
                                    <div className={styles.infoBox} style={{ marginBottom: 12 }}>
                                        <div>Oferta: <b>{payForJob?.title ?? '—'}</b></div>
                                        <div>
                                            Fee a pagar:{' '}
                                            <b>
                                                {(() => {
                                                    const fee = getFeeForJob(payForJob);
                                                    if ((payForJob?.currency ?? '').toUpperCase() === 'USD' && (payForJob?.salary ?? 0) > 0) {
                                                        const q = computeCmeFeeUSD(payForJob!.salary!);
                                                        return `${q.feeLabel} (${formatMoney('USD', q.feeValue)})`;
                                                    }
                                                    return formatMoney(fee.currency, fee.amount);
                                                })()}
                                            </b>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                                        <button className={styles.secBtn} onClick={closePayModal}>Cancelar</button>
                                        <button className={styles.primaryBtn} onClick={beginPayment}>Pagar</button>
                                    </div>
                                </>
                            )}

                            {payStatus === 'creating' && <div className={styles.loading} style={{ textAlign: 'center' }}><PropagateLoader /></div>}

                            {payStatus === 'waiting' && (
                                <div style={{ textAlign: 'center' }}>
                                    <h3>Esperando confirmación del pago…</h3>
                                    <p>Completa el pago en la pestaña que se abrió.</p>
                                    <div style={{ marginTop: 12 }}>
                                        <button className={styles.secBtn} onClick={closePayModal}>Cerrar</button>
                                    </div>
                                </div>
                            )}

                            {payStatus === 'approved' && (
                                <div style={{ textAlign: 'center' }}>
                                    <h3>Pago aprobado</h3>
                                    <div style={{ marginTop: 12 }}>
                                        {payDbStatus === 'saving' && <p>Registrando pago</p>}
                                        {payDbStatus === 'ok' && <p>Pago registrado</p>}
                                        {payDbStatus === 'failed' && (<p>No se pudo registrar el pago.</p>)}
                                    </div>
                                    <p style={{ marginTop: 8 }}>La referencia fue marcada como <b>Contratado</b>.</p>
                                    <div style={{ marginTop: 12 }}>
                                        <button className={styles.primaryBtn} onClick={closePayModal}>Cerrar</button>
                                    </div>
                                </div>
                            )}

                            {payStatus === 'rejected' && (
                                <div style={{ textAlign: 'center' }}>
                                    <h3>Pago rechazado</h3>
                                    <p>No se aplicó el cambio de estado.</p>
                                    <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'center' }}>
                                        <button className={styles.secBtn} onClick={closePayModal}>Cerrar</button>
                                        <button className={styles.primaryBtn} onClick={beginPayment}>Intentar de nuevo</button>
                                    </div>
                                </div>
                            )}

                            {payStatus === 'error' && (
                                <div style={{ textAlign: 'center' }}>
                                    <h3>Error</h3>
                                    <p>{payError ?? 'No se pudo iniciar el pago'}</p>
                                    <div style={{ marginTop: 12 }}>
                                        <button className={styles.secBtn} onClick={closePayModal}>Cerrar</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function pillClass(s?: string | null, css?: any) {
    const v = (s ?? '').toLowerCase();
    switch (v) {
        case 'open': return css.pillOk;
        case 'paused': return css.pillWarn;
        case 'closed': return css.pillMuted;
        default: return css.pillInfo;
    }
}
