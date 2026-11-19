'use client';
import React, { useMemo, useState } from 'react';
import styles from './register.module.css';
import Image from 'next/image';
import LoginPhoto from '../../../public/images/loginPhoto.png';
import CMELOGO from '../../../public/images/CMELOGO.png';
import Google from '../../../public/images/icons/Google.png';
import Facebook from '../../../public/images/icons/Facebook.png';
import { Eye, EyeOff } from "lucide-react";
import { useRouter } from 'next/navigation';
import { nextFromLocation } from '../../../lib/safe-next';

type Role = 'candidate' | 'headhunter' | 'admin';

export default function Register() {
  const [fullName, setFullName] = useState('');
  const [countryCode, setCountryCode] = useState('+507');
  const [phoneLocal, setPhoneLocal] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('headhunter');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [formError, setFormError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const router = useRouter();

  const handleRegisterLink = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const next = nextFromLocation("");
    router.push(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  };

  const phone = useMemo(() => {
    const cc = countryCode.trim().startsWith('+') ? countryCode.trim() : `+${countryCode.trim()}`;
    const local = phoneLocal.replace(/[^\d]/g, '');
    return `${cc}${local}`;
  }, [countryCode, phoneLocal]);

  function validatePhone(): string | null {
    if (!countryCode.trim()) return 'Selecciona el código de país.';
    if (!/^\+?\d{1,4}$/.test(countryCode.trim())) return 'Código de país inválido.';
    if (!phoneLocal.trim()) return 'Ingresa tu número de teléfono.';
    if (!/^\d{6,15}$/.test(phoneLocal.replace(/[^\d]/g, ''))) return 'Teléfono inválido (6–15 dígitos).';
    return null;
  }

  const handleregisterSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);
    setConfirmError(null);

    if (!fullName.trim() || !email.trim() || !password.trim() || !confirmPassword.trim()) {
      setFormError('Por favor completa todos los campos.');
      return;
    }
    const phoneErr = validatePhone();
    if (phoneErr) { setFormError(phoneErr); return; }

    if (password !== confirmPassword) {
      setConfirmError('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email,
          password,
          fullName,
          phone,
          role,
        }),
      });

      const text = await res.text();
      let json: any = null;
      try { json = text ? JSON.parse(text) : null; }
      catch { throw new Error(`Respuesta no-JSON del servidor: ${text?.slice(0, 200)}`); }

      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);

      const next = nextFromLocation("");
      router.push(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
    } catch (err: any) {
      setFormError(err?.message || 'Ocurrió un error al registrar la cuenta.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.main}>
      <div className={styles.mainInnerContainer}>
        <div className={styles.registerPhotoWrapper}>
          <Image
            className={styles.registerPhoto}
            src={LoginPhoto}
            alt="Foto de register"
            fill
            priority
          />
        </div>
        <div className={styles.registerFormContainer}>
          <Image className={styles.cmeLogo} src={CMELOGO} alt="Mi logo" width={250} height={250} priority />
          <h2 className={styles.subtitle}>Regístrate</h2>

          <form onSubmit={handleregisterSubmit} className={styles.registerForm}>
            {formError && <div className={styles.formError} role="alert" aria-live="polite">{formError}</div>}

            <input
              type="text"
              placeholder="Nombre Completo"
              value={fullName}
              onChange={(e) => { setFullName(e.target.value); setFormError(null); }}
              required
            />

            <div className={styles.phoneRow}>
              <input
                className={styles.countryCode}
                type="text"
                placeholder="+507"
                value={countryCode}
                onChange={(e) => { setCountryCode(e.target.value); setFormError(null); }}
                required
                inputMode="tel"
              />
              <input
                className={styles.phoneLocal}
                type="tel"
                placeholder="Número de teléfono"
                value={phoneLocal}
                onChange={(e) => { setPhoneLocal(e.target.value); setFormError(null); }}
                required
                inputMode="tel"
              />
            </div>

            <input
              type="email"
              placeholder="Correo Electrónico"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setFormError(null); }}
              required
            />

            {/* Role */}
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className={styles.select}
            >
              <option value="candidate">Candidato</option>
              <option value="company_admin">Empresario</option>
            </select>

            <div className={styles.passwordField}>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Contraseña"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setFormError(null); setConfirmError(null); }}
                required
                aria-invalid={!!confirmError}
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

            <div className={styles.passwordField}>
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Confirma tu contraseña"
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setConfirmError(null); setFormError(null); }}
                required
                aria-invalid={!!confirmError}
                aria-describedby={confirmError ? 'confirm-error' : undefined}
              />
              <button
                type="button"
                className={styles.togglePassword}
                onClick={() => setShowConfirmPassword(v => !v)}
                aria-label={showConfirmPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                title={showConfirmPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>

            {confirmError && (
              <div id="confirm-error" className={styles.fieldError} role="alert" aria-live="polite">
                {confirmError}
              </div>
            )}

            <button type="submit" className={styles.sendButton} disabled={loading}>
              {loading ? 'Creando cuenta…' : 'Crear cuenta'}
            </button>

            <div className={styles.registerLink}>
              <p>¿Ya tienes cuenta?</p>
              <a href="#" onClick={handleRegisterLink}>Inicia sesión aquí</a>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
