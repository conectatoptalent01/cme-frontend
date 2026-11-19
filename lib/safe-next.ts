/**
 * Devuelve la ruta a la que volver después de iniciar sesión o registrarse (?next=...).
 * Solo acepta rutas internas ("/algo"), nunca otra web: evita que un enlace malicioso
 * use el login de CME para mandar a la gente a un sitio falso.
 */
export function safeNextPath(raw: string | null | undefined, fallback = "/"): string {
  const v = String(raw ?? "").trim();
  if (!v.startsWith("/") || v.startsWith("//") || v.startsWith("/\\")) return fallback;
  if (/^\/+[a-z][a-z0-9+.-]*:/i.test(v)) return fallback;
  return v;
}

export function nextFromLocation(fallback = "/"): string {
  if (typeof window === "undefined") return fallback;
  return safeNextPath(new URLSearchParams(window.location.search).get("next"), fallback);
}
