'use client';
import React, { useState } from 'react';
import styles from './login.module.css';
import Image from 'next/image';
import LoginPhoto from '../../../public/images/loginPhoto.png';
import CMELOGO from '../../../public/images/CMELOGO.png';
import Google from '../../../public/images/icons/Google.png';
import { Eye, EyeOff } from "lucide-react";
import { useRouter } from 'next/navigation';
import { nextFromLocation } from '../../../lib/safe-next';
import { supabase } from '../../../lib/supabase-client';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const router = useRouter();

    const handleForgotPassword = (e: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => {
        e.preventDefault();
    };

    const handleRegister = (e: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => {
        e.preventDefault();
        const next = nextFromLocation("");
        router.push(next ? `/register?next=${encodeURIComponent(next)}` : "/register");
    };

    async function signInWithGoogle() {
        const next = nextFromLocation("");
        if (next) window.sessionStorage.setItem("post_login_next", next);
        const redirectTo = `${window.location.origin}/auth/callback${next ? `?next=${encodeURIComponent(next)}` : ""}`;
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo }
        });
        if (error) console.error('Error iniciando OAuth:', error);
    }

    function mapGraphQLError(msg: string) {
        const m = msg.toLowerCase();
        if (m.includes('invalid credentials') || m.includes('unauthorized') || m.includes('forbidden')) {
            return 'Credenciales inválidas. Verifica tu correo y contraseña.';
        }
        if (m.includes('user not found')) {
            return 'No encontramos una cuenta con ese correo.';
        }
        if (m.includes('account locked') || m.includes('disabled')) {
            return 'Tu cuenta está bloqueada o deshabilitada. Contacta soporte.';
        }
        if (m.includes('network') || m.includes('fetch') || m.includes('timeout')) {
            return 'Problema de red. Revisa tu conexión e inténtalo de nuevo.';
        }
        return 'Ocurrió un error al iniciar sesión. Inténtalo de nuevo.';
    }

    const handleLoginSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setFormError(null);

        if (!email.trim() || !password.trim()) {
            setFormError('Completa correo y contraseña.');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch("/api/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password, rememberMe }),
                credentials: "include",
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Login failed");
            router.push(nextFromLocation("/"));
        } catch (err: any) {
            const message = typeof err?.message === 'string' ? err.message : 'Error desconocido';
            setFormError(mapGraphQLError(message));
            console.error('Login error:', message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.main}>
            <div className={styles.mainInnerContainer}>
                <div className={styles.loginFormContainer}>
                    <Image
                        className={styles.cmeLogo}
                        src={CMELOGO}
                        alt="Mi logo"
                        width={320}
                        height={320}
                        priority
                    />
                    <h2 className={styles.subtitle}>BIENVENIDO</h2>

                    <form className={styles.loginForm}>
                        <button type="button" className={styles.socialMediaLoginButtion} onClick={signInWithGoogle}>
                            <Image className={styles.cmeLogo} src={Google} alt="GoogleIcon" width={20} height={20} style={{ width: 20, height: 20 }} priority />
                            Continua con Google
                        </button>
                    </form>

                    <div className={styles.divider}>
                        <div className={styles.line}></div>
                        <p>o</p>
                        <div className={styles.line}></div>
                    </div>

                    <form onSubmit={handleLoginSubmit} className={styles.loginForm}>
                        {formError && (
                            <div className={styles.formError} role="alert" aria-live="polite">
                                {formError}
                            </div>
                        )}

                        <input
                            type="email"
                            placeholder="Correo Electronico"
                            value={email}
                            onChange={(e) => { setEmail(e.target.value); if (formError) setFormError(null); }}
                            required
                        />

                        <div className={styles.passwordField}>
                            <input
                                type={showPassword ? 'text' : 'password'}
                                placeholder="Contraseña"
                                value={password}
                                onChange={(e) => { setPassword(e.target.value); if (formError) setFormError(null); }}
                                required
                            />
                            <button
                                type="button"
                                className={styles.togglePassword}
                                onClick={() => setShowPassword(v => !v)}
                                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                                title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                            >
                                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                        </div>

                        <div className={styles.formOptions}>
                            <label className={styles.rememberMe}>
                                <input
                                    type="checkbox"
                                    name="recuerdame"
                                    checked={rememberMe}
                                    onChange={(e) => setRememberMe(e.target.checked)}
                                />
                                <p>Recuerdame</p>
                            </label>
                            <a href="#" onClick={handleForgotPassword}>¿Olvidaste tu contraseña?</a>
                        </div>

                        <button type="submit" className={styles.sendButton} disabled={loading}>
                            {loading ? 'Ingresando…' : 'Iniciar Sesión'}
                        </button>

                        <div className={styles.registerLink}>
                            <p>¿No tienes cuenta aun? </p>
                            <a href="#" onClick={handleRegister}>Registrate aqui</a>
                        </div>
                    </form>
                </div>

                <Image className={styles.loginPhoto} src={LoginPhoto} alt="Foto de login" width={1200} height={1500} priority />
            </div>
        </div>
    );
}