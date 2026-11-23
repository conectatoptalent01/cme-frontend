/** Llama al backend a través de /api/backend/... y lanza un Error con el código del backend si falla. */
export async function backend<T = any>(path: string, init?: { method?: "GET" | "POST" | "DELETE"; body?: unknown }): Promise<T> {
  const res = await fetch(`/api/backend/${path.replace(/^\/+/, "")}`, {
    method: init?.method ?? "GET",
    headers: { Accept: "application/json", ...(init?.body !== undefined ? { "Content-Type": "application/json" } : {}) },
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    credentials: "include",
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(String(json?.error || `HTTP ${res.status}`)) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return json as T;
}
