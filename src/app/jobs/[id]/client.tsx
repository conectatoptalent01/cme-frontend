"use client";

import { useState } from "react";
import useSWR from "swr";
import Image from "next/image";
import { useRouter } from "next/navigation";
import styles from "./jobs.module.css";
import { PropagateLoader } from "react-spinners";
import { employmentTypeLabel } from "../../../../lib/employment-type";

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

function InfoModal({
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

function CodeModal({
    open,
    onCancel,
    onUseCode,
}: {
    open: boolean;
    onCancel: () => void;
    onUseCode: (code: string) => void;
}) {
    const [code, setCode] = useState("");

    const isCodeValid = /^[A-Z0-9]{6}$/.test(code || "");

    function onChangeCode(e: React.ChangeEvent<HTMLInputElement>) {
        const cleaned = e.target.value
            .replace(/[^a-zA-Z0-9]/g, "")
            .toUpperCase()
            .slice(0, 6);
        setCode(cleaned);
    }

    if (!open) return null;

    return (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true">
            <div className={styles.modalCard}>
                <h3 className={styles.modalTitle}>Ingresar código de referencia</h3>
                <p className={styles.modalBody}>
                    Escribe el código de 6 caracteres (A–Z y 0–9) que te compartieron.
                </p>

                <div className={styles.formGrid}>
                    <label className={styles.formField}>
                        <span>Código (6)</span>
                        <input
                            type="text"
                            placeholder="ABC123"
                            maxLength={6}
                            value={code}
                            onChange={onChangeCode}
                            className={styles.input}
                            aria-label="Código de referido de seis caracteres"
                        />
                    </label>
                </div>

                <div
                    className={styles.modalActions}
                    style={{ justifyContent: "space-between" }}
                >
                    <button className={styles.secundaryBtn} onClick={onCancel}>
                        Cancelar
                    </button>
                    <button
                        className={styles.primaryBtn}
                        onClick={() => onUseCode(code)}
                        disabled={!isCodeValid}
                        aria-disabled={!isCodeValid}
                        title={!isCodeValid ? "Ingresa un código válido de 6 caracteres" : undefined}
                    >
                        Usar código
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function JobDetailClient({ jobId }: Props) {
    const router = useRouter();

    const { data, error, isLoading } = useSWR(jobId ? `/api/jobs/${jobId}` : null, fetcher);
    const { data: meData } = useSWR(`/api/me`, fetcher);
    const userId: string | null = meData?.user?.id ?? null;

    const [infoOpen, setInfoOpen] = useState(false);
    const [infoTitle, setInfoTitle] = useState("");
    const [infoMsg, setInfoMsg] = useState("");

    const [codeOpen, setCodeOpen] = useState(false);

    function openInfo(title: string, message: string) {
        setInfoTitle(title);
        setInfoMsg(message);
        setInfoOpen(true);
    }

    function handleOpenCodeModal() {
        if (!userId) {
            router.push(`/login?next=/jobs/${jobId}`);
            return;
        }
        setCodeOpen(true);
    }

    async function handleUseCode(code: string) {
        try {
            const res = await fetch("/api/referrals/consume?debug=1", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-debug": "1",
                },
                body: JSON.stringify({ jobOfferId: jobId, code, candidateId: userId }),
            });

            const json = await res.json().catch(() => ({}));

            if (res.status === 401) {
                router.push(`/login?next=/jobs/${jobId}`);
                return;
            }
            if (!res.ok) {
                const readable =
                    json?.error === "referral_not_found_for_offer"
                        ? "No encontramos una referencia con ese código para esta oferta."
                        : json?.error === "candidate_id_required"
                            ? "No se detectó el candidato. Inicia sesión como candidato o reintenta."
                            : json?.error || "No se pudo validar el código.";
                throw new Error(readable);
            }

            const headhunterId = json?.referral?.headhunter_id;
            const jobTitle = json?.referral?.job_title ?? job?.title ?? "una oferta";

            if (headhunterId) {
                await fetch("/api/notifications", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", Accept: "application/json" },
                    body: JSON.stringify({
                        userId: headhunterId,
                        title: "Tu candidato aceptó la referencia 🎉",
                        message: `El candidato ha usado tu código para la oferta "${jobTitle}".`,
                        notificationType: "recommendation",
                        channel: "system",
                        relatedId: jobId,
                    }),
                });
            }

            setCodeOpen(false);
            openInfo("¡Código aplicado!", "Tu recomendación ha sido asociada con éxito.");
        } catch (e: any) {
            setCodeOpen(false);
            openInfo("Error", e?.message || "No se pudo validar el código.");
        }
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

    return (
        <>
            <InfoModal
                open={infoOpen}
                title={infoTitle}
                message={infoMsg}
                onClose={() => setInfoOpen(false)}
            />

            <CodeModal
                open={codeOpen}
                onCancel={() => setCodeOpen(false)}
                onUseCode={handleUseCode}
            />

            <div className={styles.card}>
                <div className={styles.coverBox}>
                    {companyCover ? (
                        <Image src={companyCover} alt="" fill className={styles.coverImg} priority />
                    ) : (
                        <div className={styles.coverPlaceholder} />
                    )}
                </div>

                <div className={styles.headerRow}>
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

                    <div className={styles.headerInfo}>
                        <div className={styles.title}>{job.title}</div>
                        <div className={styles.meta}>
                            <span className={styles.muted}>{companyName}</span>
                            <span className={styles.dot}>•</span>
                            <span className={styles.muted}>{loc}</span>
                        </div>
                        <div className={styles.meta}>
                            <span>
                                <b>Tipo:</b> {employmentTypeLabel(job.employment_type)}
                            </span>
                            <span className={styles.dot}>•</span>
                            <span>
                                <b>Modalidad:</b> {job.location_type ?? "—"}
                            </span>
                            <span className={styles.dot}>•</span>
                            <span>
                                <b>Salario:</b> {salary}
                            </span>
                        </div>
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
                    <div className={styles.section}>
                        <h3 className={styles.sectionTitle}>Descripción</h3>
                        <p className={styles.text}>{job.description}</p>
                    </div>
                )}

                {job.requirements && (
                    <div className={styles.section}>
                        <h3 className={styles.sectionTitle}>Requisitos</h3>
                        <p className={styles.text}>{job.requirements}</p>
                    </div>
                )}

                <div className={styles.actions}>
                    <button
                        type="button"
                        className={styles.primaryBtn}
                        onClick={handleOpenCodeModal}
                    >
                        Tengo un código de referencia
                    </button>
                </div>
            </div>
        </>
    );
}
