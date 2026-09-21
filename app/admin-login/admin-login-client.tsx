"use client";

import { useState } from "react";

export default function AdminLoginClient({ returnTo }: { returnTo: string }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <main className="admin-login-page">
      <section className="admin-login-card">
        <span className="mini-crest">TR</span>
        <p className="eyebrow">TOWNSHIP ROLLERS FC</p>
        <h1>Administrator sign in</h1>
        <p>Use your authorised email and six-digit administrator PIN.</p>

        <form
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            setError("");
            const form = new FormData(event.currentTarget);

            try {
              const response = await fetch("/api/admin-pin", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  email: form.get("email"),
                  pin: form.get("pin"),
                }),
              });
              const data = await response.json();
              if (!response.ok) throw new Error(data.error);
              location.assign(returnTo);
            } catch (signInError) {
              setError(
                signInError instanceof Error
                  ? signInError.message
                  : "Could not sign in",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Email
            <input name="email" type="email" autoComplete="username" required />
          </label>
          <label>
            Six-digit PIN
            <input
              name="pin"
              type="password"
              inputMode="numeric"
              pattern="[0-9]{6}"
              minLength={6}
              maxLength={6}
              autoComplete="current-password"
              required
            />
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="primary" disabled={busy}>
            {busy ? "Signing in…" : "Sign in with PIN"}
          </button>
        </form>

        <a className="login-back" href="/">
          ← Back to portal
        </a>
      </section>
    </main>
  );
}
