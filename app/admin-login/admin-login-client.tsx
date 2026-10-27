"use client";

import { ClubLogo } from "../components/club-logo";
import { signIn } from "next-auth/react";
import QRCode from "qrcode";
import { useState } from "react";

type Mode = "login" | "enroll" | "verify" | "recovery";
type MfaSetup = { mode: "enroll" | "verify"; provisioningUri?: string; secret?: string; error?: string };

export default function AdminLoginClient({ returnTo, googleEmail }: { returnTo: string; googleEmail?: string }) {
  const [mode, setMode] = useState<Mode>("login");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [qr, setQr] = useState("");
  const [secret, setSecret] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [code, setCode] = useState("");

  async function loadAuthenticator() {
    const response = await fetch("/api/admin-mfa", { cache: "no-store", credentials: "same-origin" });
    const data = await response.json() as MfaSetup;
    if (!response.ok) throw new Error(data.error || "Could not start authenticator verification.");
    setMode(data.mode);
    if (data.mode === "enroll" && data.provisioningUri && data.secret) {
      setSecret(data.secret);
      try {
        const url = await QRCode.toDataURL(data.provisioningUri, { width: 220, margin: 2 });
        setQr(url);
      } catch {
        // The manual setup key is always available if QR rendering fails.
        setQr("");
      }
    }
  }
  async function startGoogleMfa() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin-mfa/google", { method: "POST", credentials: "same-origin" });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Google verification could not start.");
      await loadAuthenticator();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Google verification could not start.");
    } finally { setBusy(false); }
  }
  async function submitPin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/admin-pin", {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email: form.get("email"), pin: form.get("pin") }),
      });
      const data = await response.json() as { error?: string; mfaRequired?: boolean };
      if (!response.ok || !data.mfaRequired) throw new Error(data.error || "Sign-in could not be verified.");
      await loadAuthenticator();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not sign in.");
    } finally { setBusy(false); }
  }
  async function submitMfa(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin-mfa", {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "same-origin", body: JSON.stringify({ code }),
      });
      const data = await response.json() as { error?: string; recoveryCodes?: string[] };
      if (!response.ok) throw new Error(data.error || "Authenticator code was not accepted.");
      if (data.recoveryCodes?.length) {
        setRecoveryCodes(data.recoveryCodes);
        setMode("recovery");
        setCode("");
      } else {
        window.location.assign(returnTo);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not verify your code.");
    } finally { setBusy(false); }
  }

  return <main className="admin-login-page">
    <section className="admin-login-card">
      <ClubLogo/>
      <p className="eyebrow">TOWNSHIP ROLLERS FC</p>
      <h1>Administrator sign in</h1>
      {mode === "login" && <>
        <p>Enter your authorised email and PIN, then verify with Google Authenticator.</p>
        <form onSubmit={submitPin}>
          <label>Email<input name="email" type="email" autoComplete="username" required /></label>
          <label>Six-digit PIN<input name="pin" type="password" inputMode="numeric" pattern="[0-9]{6}" minLength={6} maxLength={6} autoComplete="current-password" required /></label>
          <button className="primary" disabled={busy}>{busy ? "Verifying…" : "Continue securely"}</button>
        </form>
        <div style={{marginTop:18, borderTop:"1px solid #e1e6ef", paddingTop:16}}>
          {googleEmail
            ? <button type="button" className="primary" disabled={busy} onClick={() => void startGoogleMfa()}>Verify Google account ({googleEmail})</button>
            : <button type="button" disabled={busy} onClick={() => void signIn("google", { redirectTo: "/admin-login" })}>Continue with Google</button>}
          <p style={{fontSize:13}}>Google sign-in also requires Google Authenticator before administrator access.</p>
        </div>
      </>}
      {mode === "enroll" && <>
        <p><strong>Secure your administrator account</strong></p>
        <p>Scan this QR code in Google Authenticator, or enter the setup key manually. Then enter the six-digit code to activate protection.</p>
        {qr && <img src={qr} alt="QR code for registering Township Rollers FC in Google Authenticator" style={{display:"block",width:220,maxWidth:"100%",margin:"18px auto"}}/>}
        <p style={{overflowWrap:"anywhere",fontSize:13}}>Manual setup key: <code>{secret}</code></p>
        <form onSubmit={submitMfa}>
          <label>Google Authenticator code<input name="code" autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" minLength={6} maxLength={6} value={code} onChange={event => setCode(event.target.value)} required /></label>
          <button className="primary" disabled={busy}>{busy ? "Activating…" : "Activate authenticator"}</button>
        </form>
      </>}
      {mode === "verify" && <>
        <p>Enter your current six-digit Google Authenticator code, or one of your unused recovery codes.</p>
        <form onSubmit={submitMfa}>
          <label>Authenticator or recovery code<input name="code" autoComplete="one-time-code" value={code} onChange={event => setCode(event.target.value)} required /></label>
          <button className="primary" disabled={busy}>{busy ? "Verifying…" : "Verify and sign in"}</button>
        </form>
      </>}
      {mode === "recovery" && <>
        <p><strong>Save these one-time recovery codes.</strong> You will only see them once. Store them securely outside your phone.</p>
        <div style={{background:"#f4f6fa",borderRadius:12,padding:16,display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:9,margin:"16px 0"}}>
          {recoveryCodes.map(item => <code key={item} style={{fontSize:13,wordBreak:"break-word"}}>{item}</code>)}
        </div>
        <button type="button" onClick={() => void navigator.clipboard.writeText(recoveryCodes.join("\n"))}>Copy recovery codes</button>
        <button type="button" className="primary" onClick={() => window.location.assign(returnTo)}>I have saved my recovery codes</button>
      </>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <a className="login-back" href="/">← Back to portal</a>
    </section>
  </main>;
}
