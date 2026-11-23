// src/app/profiles/users/page.tsx
import Image from "next/image";
import Link from "next/link";
import { headers as nextHeaders, cookies as nextCookies } from "next/headers";
import Navbar from "../../../../components/navbar/navbar";
import styles from "./userProfile.module.css";
import ProfileReputation from "../../../../components/reputation/ProfileReputation";
import ConfirmedReferences from "../../../../components/workReferences/ConfirmedReferences";

export const dynamic = "force-dynamic";

type ExperienceItem = {
  role?: string | null;
  company?: string | null;
  start?: string | null;
  end?: string | null;
  description?: string | null;
};

type EducationItem = {
  degree?: string | null;
  institution?: string | null;
  start?: string | null;
  end?: string | null;
  description?: string | null;
};

type Profile = {
  id: string;
  email: string;
  full_name?: string | null;
  profile_picture?: string | null;
  cover_photo?: string | null;
  role?: string | null;
  occupation?: string | null;
  skills?: string[] | null;
  about_me?: string | null;
  phone?: string | null;
  experience?: ExperienceItem[] | null;
  education?: EducationItem[] | null;
  cv_url?: string | null;
};

async function getOrigin() {
  const hdrs = await nextHeaders();
  const host = hdrs.get("host") || "localhost:3001";
  const proto = hdrs.get("x-forwarded-proto") || "http";
  return `${proto}://${host}`;
}

async function getProfileById(id: string): Promise<Profile | null> {
  try {
    const origin = await getOrigin();
    const ck = await nextCookies();
    const cookieHeader = ck
      .getAll()
      .map((c) => `${c.name}=${encodeURIComponent(c.value)}`)
      .join("; ");
    const res = await fetch(
      `${origin}/api/profiles/${encodeURIComponent(id)}`,
      {
        cache: "no-store",
        headers: cookieHeader
          ? { cookie: cookieHeader, Accept: "application/json" }
          : { Accept: "application/json" },
      }
    );
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    if (!data) return null;
    if (data.profile) return data.profile as Profile;
    return data as Profile;
  } catch {
    return null;
  }
}

function hasValidExperience(exp: ExperienceItem[] | null | undefined) {
  if (!Array.isArray(exp)) return false;
  return exp.some(
    (e) =>
      e?.role ||
      e?.company ||
      e?.start ||
      e?.end ||
      (e?.description && e.description.trim() !== "")
  );
}

function hasValidEducation(edu: EducationItem[] | null | undefined) {
  if (!Array.isArray(edu)) return false;
  return edu.some(
    (e) =>
      e?.degree ||
      e?.institution ||
      e?.start ||
      e?.end ||
      (e?.description && e.description.trim() !== "")
  );
}

export default async function Page(context: any) {
  const searchParams = await context.searchParams;
  const id = searchParams?.id?.trim();
  const profile = id ? await getProfileById(id) : null;

  return (
    <div className={styles.main}>
      <Navbar />
      <div className={styles.content}>
        {!id && (
          <div className={styles.card}>
            <h2>Falta el ID de usuario</h2>
            <p>
              Pasa el parámetro <code>?id=&lt;usuario-id&gt;</code> en la URL.
            </p>
            <div className={styles.actions}>
              <Link className={styles.ctaBtn} href="/profiles">
                Volver
              </Link>
            </div>
          </div>
        )}

        {id && !profile && (
          <div className={styles.errorCard}>
            <h2>No encontramos este perfil</h2>
            <p>Verifica que el perfil exista y/o sea público.</p>
            <div className={styles.actions}>
              <Link className={styles.ctaBtn} href="/search/users">
                Volver
              </Link>
            </div>
          </div>
        )}

        {id && profile && (
          <div className={styles.card}>
            <div className={styles.coverContainer}>
              {profile.cover_photo ? (
                <Image
                  src={profile.cover_photo}
                  alt={profile.full_name ?? profile.email}
                  fill
                  className={styles.cover}
                  priority
                />
              ) : (
                <div className={styles.coverFallback} aria-hidden />
              )}
            </div>

            <div className={styles.infoSection}>
              <div className={styles.avatarWrap}>
                {profile.profile_picture ? (
                  <Image
                    src={profile.profile_picture}
                    alt={profile.full_name ?? profile.email}
                    width={112}
                    height={112}
                    className={styles.avatar}
                    priority
                  />
                ) : (
                  <div className={styles.avatarPlaceholder} aria-hidden />
                )}
              </div>

              <div className={styles.identity}>
                <h2 className={styles.name}>
                  {profile.full_name ||
                    profile.email.split("@")[0] ||
                    "Usuario"}
                </h2>
                {id && <ProfileReputation userId={id} />}
              </div>
            </div>

            <div className={styles.section}>
              <h3>Sobre mí</h3>
              {profile.about_me && profile.about_me.trim().length ? (
                <p className={styles.occupation}>{profile.about_me}</p>
              ) : (
                <p className={styles.muted}>Sin descripción</p>
              )}
            </div>

            {id && <ConfirmedReferences candidateId={id} sectionClassName={styles.section} />}

            <div className={styles.section}>
              <h3>Habilidades</h3>
              {profile.skills?.length ? (
                <ul className={styles.skills}>
                  {profile.skills.map((s) => (
                    <li key={s} className={styles.skill}>
                      {s}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.muted}>No se han añadido Habilidades.</p>
              )}
            </div>

            <div className={styles.section}>
              <h3>Detalles</h3>
              <dl className={styles.detailList}>
                <div className={styles.detailRow}>
                  <dt>Email</dt>
                  <dd>{profile.email}</dd>
                </div>
                <div className={styles.detailRow}>
                  <dt>Ocupación</dt>
                  <dd>{profile.occupation ?? "—"}</dd>
                </div>
                <div className={styles.detailRow}>
                  <dt>Teléfono</dt>
                  <dd>{profile.phone ?? "—"}</dd>
                </div>
              </dl>
            </div>

            <div className={styles.section}>
              <h3>Experiencia</h3>
              {hasValidExperience(profile.experience) ? (
                <div className={styles.gridCards}>
                  {profile.experience!.map((it, i) => {
                    const left = (it.start || "").trim();
                    const right = (it.end || "").trim();
                    const dates =
                      left || right ? `${left}${right ? ` – ${right}` : ""}` : "—";
                    return (
                      <div className={styles.infoCard} key={`exp-${i}`}>
                        <div className={styles.cardTop}>
                          <div className={styles.cardLeft}>
                            <h4 className={styles.cardTitle}>{it.role || "—"}</h4>
                            {it.company ? (
                              <p className={styles.cardSubtitle}>{it.company}</p>
                            ) : null}
                          </div>
                          <span className={styles.datePill}>{dates}</span>
                        </div>
                        {it.description ? (
                          <p className={styles.cardDesc}>{it.description}</p>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className={styles.emptyCard}>Sin experiencia registrada.</div>
              )}
            </div>

            <div className={styles.section}>
              <h3>Educación</h3>
              {hasValidEducation(profile.education) ? (
                <div className={styles.gridCards}>
                  {profile.education!.map((it, i) => {
                    const left = (it.start || "").trim();
                    const right = (it.end || "").trim();
                    const dates =
                      left || right ? `${left}${right ? ` – ${right}` : ""}` : "—";
                    return (
                      <div className={styles.infoCard} key={`edu-${i}`}>
                        <div className={styles.cardTop}>
                          <div className={styles.cardLeft}>
                            <h4 className={styles.cardTitle}>{it.degree || "—"}</h4>
                            {it.institution ? (
                              <p className={styles.cardSubtitle}>{it.institution}</p>
                            ) : null}
                          </div>
                          <span className={`${styles.datePill} ${styles.eduPill}`}>
                            {dates}
                          </span>
                        </div>
                        {it.description ? (
                          <p className={styles.cardDesc}>{it.description}</p>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className={styles.emptyCard}>Sin educación registrada.</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
