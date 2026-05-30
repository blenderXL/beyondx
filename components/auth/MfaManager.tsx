"use client";

import { useEffect, useState, type FormEvent } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Stage = "loading" | "disabled" | "enrolling" | "enabled";

interface Enrollment {
  factorId: string;
  qrCode: string;
  secret: string;
}

const codeInputClass =
  "h-11 w-40 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-elevated)] px-3 text-center font-mono text-lg tracking-[0.4em] text-[var(--color-text-primary)] outline-none focus:border-[var(--color-text-primary)]";
const primaryBtn =
  "flex h-11 items-center justify-center rounded-md bg-[var(--color-text-primary)] px-5 font-mono text-xs uppercase tracking-[0.18em] text-[var(--color-canvas)] transition-opacity hover:opacity-90 disabled:opacity-60";
const ghostBtn =
  "flex h-11 items-center justify-center rounded-md border border-[var(--color-border-strong)] bg-[var(--color-elevated)] px-5 font-mono text-xs uppercase tracking-[0.18em] text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)] disabled:opacity-60";

export function MfaManager() {
  const supabase = getSupabaseBrowserClient();
  const [stage, setStage] = useState<Stage>("loading");
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const { data, error: listError } = await supabase.auth.mfa.listFactors();
    if (listError) {
      setError("Could not load your security settings.");
      return;
    }
    setStage(data.totp.length > 0 ? "enabled" : "disabled");
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startEnroll() {
    setBusy(true);
    setError(null);
    const { data, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: "totp" });
    setBusy(false);
    if (enrollError || !data) {
      setError(enrollError?.message ?? "Could not start enrollment.");
      return;
    }
    setEnrollment({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret });
    setStage("enrolling");
  }

  async function confirmEnroll(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!enrollment) return;
    setBusy(true);
    setError(null);
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId: enrollment.factorId,
    });
    if (challengeError || !challenge) {
      setBusy(false);
      setError("Could not verify the code. Try again.");
      return;
    }
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: enrollment.factorId,
      challengeId: challenge.id,
      code,
    });
    setBusy(false);
    if (verifyError) {
      setError("That code didn't match. Check your authenticator and try again.");
      return;
    }
    setEnrollment(null);
    setCode("");
    await refresh();
  }

  async function cancelEnroll() {
    setBusy(true);
    if (enrollment) {
      await supabase.auth.mfa.unenroll({ factorId: enrollment.factorId });
    }
    setEnrollment(null);
    setCode("");
    setError(null);
    setBusy(false);
    await refresh();
  }

  async function disableMfa() {
    setBusy(true);
    setError(null);
    const { data } = await supabase.auth.mfa.listFactors();
    for (const factor of data?.all ?? []) {
      await supabase.auth.mfa.unenroll({ factorId: factor.id });
    }
    // Drop the AAL2 claim immediately rather than waiting for the next refresh.
    await supabase.auth.refreshSession();
    setBusy(false);
    await refresh();
  }

  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-6">
      <p className="font-mono text-[10px] tracking-[0.22em] text-[var(--color-text-muted)] uppercase">
        // two-factor authentication
      </p>

      {stage === "loading" ? (
        <p className="mt-4 font-mono text-sm text-[var(--color-text-muted)]">// checking…</p>
      ) : null}

      {stage === "disabled" ? (
        <div className="mt-4 space-y-4">
          <p className="max-w-prose font-sans text-sm text-[var(--color-text-secondary)]">
            Add an authenticator app (Google Authenticator, 1Password, Authy…) for a second layer of
            protection. Once enabled, you&apos;ll enter a 6-digit code each time you log in.
          </p>
          <button type="button" onClick={startEnroll} disabled={busy} className={primaryBtn}>
            {busy ? "Working…" : "Enable 2FA"}
          </button>
        </div>
      ) : null}

      {stage === "enrolling" && enrollment ? (
        <form onSubmit={confirmEnroll} className="mt-4 space-y-4">
          <p className="max-w-prose font-sans text-sm text-[var(--color-text-secondary)]">
            Scan this QR code with your authenticator app, then enter the 6-digit code to confirm.
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={enrollment.qrCode}
            alt="2FA QR code"
            width={180}
            height={180}
            className="rounded-md bg-white p-2"
          />
          <p className="font-mono text-[11px] text-[var(--color-text-muted)]">
            Or enter this key manually:{" "}
            <span data-testid="mfa-secret" className="text-[var(--color-text-primary)]">
              {enrollment.secret}
            </span>
          </p>
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            required
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="000000"
            aria-label="Authenticator code"
            className={codeInputClass}
          />
          <div className="flex gap-3">
            <button type="submit" disabled={busy || code.length !== 6} className={primaryBtn}>
              {busy ? "Verifying…" : "Verify & enable"}
            </button>
            <button type="button" onClick={cancelEnroll} disabled={busy} className={ghostBtn}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {stage === "enabled" ? (
        <div className="mt-4 space-y-4">
          <p className="font-mono text-sm text-[var(--color-accent-emerald)]">
            // 2FA is on. Your account asks for an authenticator code at login.
          </p>
          <button type="button" onClick={disableMfa} disabled={busy} className={ghostBtn}>
            {busy ? "Working…" : "Disable 2FA"}
          </button>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mt-4 font-mono text-xs text-[var(--color-accent-red)]">
          // {error}
        </p>
      ) : null}
    </div>
  );
}
