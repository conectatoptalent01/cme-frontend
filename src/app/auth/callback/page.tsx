"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";
import { PropagateLoader } from "react-spinners";
import { safeNextPath } from "../../../../lib/safe-next";

export default function AuthCallback() {
  const [err, setErr] = useState<string | null>(null);

  const params = useMemo(() => {
    const isBrowser = typeof window !== "undefined";

    const hash = new URLSearchParams(isBrowser ? window.location.hash.slice(1) : "");
    const query = new URLSearchParams(isBrowser ? window.location.search : "");

    const access_token = hash.get("access_token") || query.get("access_token") || "";
    const refresh_token = hash.get("refresh_token") || query.get("refresh_token") || "";

    let next = "/";
    if (isBrowser) {
      next = query.get("next") || window.sessionStorage.getItem("post_login_next") || "/";
    }

    return { access_token, refresh_token, next };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        if (!params.access_token) {
          setErr("No recibimos access_token");
          return window.location.replace("/login");
        }

        try {
          if (typeof window !== "undefined" && params.next) {
            window.sessionStorage.setItem("post_login_next", params.next);
          }
        } catch { }

        let rememberMe = false;
        try {
          if (typeof window !== "undefined") {
            rememberMe = window.localStorage.getItem("remember_me") === "1";
          }
        } catch { }

        const r1 = await fetch("/api/social-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            access_token: params.access_token,
            refresh_token: params.refresh_token || undefined,
            rememberMe,
          }),
        });

        if (!r1.ok) {
          console.error("social-login failed:", await r1.text());
          setErr("No se pudo iniciar sesión (social-login).");
          return window.location.replace("/login");
        }

        try {
          const url = new URL(window.location.href);
          url.hash = "";
          url.searchParams.delete("access_token");
          url.searchParams.delete("refresh_token");
          window.history.replaceState({}, "", url.toString());
        } catch { }

        const r2 = await fetch("/api/me", {
          method: "GET",
          credentials: "include",
          headers: { Accept: "application/json" },
          cache: "no-store",
        });
        if (!r2.ok) {
          console.error("me failed:", await r2.text());
          setErr("No se pudo validar la sesión.");
          return window.location.replace("/login");
        }

        let to = "/";
        try {
          if (typeof window !== "undefined") {
            to = window.sessionStorage.getItem("post_login_next") || params.next || "/";
            window.sessionStorage.removeItem("post_login_next");
          }
        } catch { }

        window.location.replace(safeNextPath(to, "/"));
      } catch (e) {
        console.error(e);
        setErr("Error en el callback de autenticación");
        window.location.replace("/login");
      }
    })();
  }, [params]);

  return (
    <div className={styles.container}>
      <div>
        <PropagateLoader color="#152048" />
      </div>
    </div>
  );
}
