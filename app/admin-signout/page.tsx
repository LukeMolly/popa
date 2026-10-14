"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { signOut } from "next-auth/react";
import { ClubLogo } from "../components/club-logo";

type SignOutStatus = "signing-out" | "done" | "error";

export default function AdminSignOut() {
  const [status, setStatus] = useState<SignOutStatus>("signing-out");
  const [error, setError] = useState("");
  const running = useRef(false);

  const completeSignOut = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    setStatus("signing-out");
    setError("");
    try {
      // Clear the PIN-backed administrator session on the server first.
      const response = await fetch("/api/admin-pin", {
        method: "DELETE",
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({})) as {error?:string};
        throw new Error(data.error || "Could not end the administrator session.");
      }
      // Also clear a potential Google/Auth.js session. redirect:false avoids
      // the framework's unbranded confirmation page.
      const result = await signOut({ redirect: false });
      if (!result?.url) throw new Error("Could not confirm the sign-out.");
      setStatus("done");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sign-out failed. Please retry.");
      setStatus("error");
    } finally {
      running.current = false;
    }
  }, []);

  useEffect(() => { void completeSignOut(); }, [completeSignOut]);

  return (
    <main className="admin-signout-page">
      <section className="admin-signout-card" aria-live="polite">
        <ClubLogo/>
        <p className="eyebrow">TOWNSHIP ROLLERS FC</p>
        {status === "signing-out" ? (
          <>
            <div className="admin-signout-symbol" aria-hidden="true">↻</div>
            <h1>Signing you out</h1>
            <p>Closing your administrator session securely.</p>
            <span className="admin-signout-progress">Please keep this page open.</span>
          </>
        ) : status === "done" ? (
          <>
            <div className="admin-signout-symbol completed" aria-hidden="true">✓</div>
            <h1>Successfully signed out</h1>
            <p>Your administrator session has ended.</p>
            <a className="admin-signout-home" href="/">Return to POPA homepage <span aria-hidden="true">→</span></a>
          </>
        ) : (
          <>
            <div className="admin-signout-symbol failed" aria-hidden="true">!</div>
            <h1>Sign-out not confirmed</h1>
            <p role="alert">{error}</p>
            <button type="button" className="admin-signout-home" onClick={()=>void completeSignOut()}>Retry sign out</button>
          </>
        )}
        <div className="admin-signout-footer">POPA POPA EA IPOPA · 2026–2027 season</div>
      </section>
    </main>
  );
}
