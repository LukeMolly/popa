"use client";
import { useEffect } from "react";

const IDLE_MS = 5 * 60 * 1000;
const HEARTBEAT_THROTTLE_MS = 10 * 1000;

export default function AdminIdleGuard() {
  useEffect(() => {
    let lastActivity = Date.now();
    let lastHeartbeat = Date.now();
    let sending = false;
    let finished = false;
    const signOut = () => {
      if (finished) return;
      finished = true;
      window.location.replace("/admin-signout");
    };
    const checkIdle = () => {
      if (Date.now() - lastActivity >= IDLE_MS) signOut();
    };
    const onActivity = () => {
      if (finished) return;
      const now = Date.now();
      // A throttled or sleeping tab must not resurrect an expired session.
      if (now - lastActivity >= IDLE_MS) { signOut(); return; }
      lastActivity = now;
      if (sending || now - lastHeartbeat < HEARTBEAT_THROTTLE_MS) return;
      sending = true;
      lastHeartbeat = now;
      void fetch("/api/admin-session", { method: "POST", credentials: "same-origin", cache: "no-store" })
        .then(response => { if (!response.ok) signOut(); })
        .catch(() => { /* The server expiration remains authoritative if offline. */ })
        .finally(() => { sending = false; });
    };
    const onVisible = () => { if (document.visibilityState === "visible") checkIdle(); };
    const timer = window.setInterval(checkIdle, 1000);
    const events: Array<keyof DocumentEventMap> = ["pointerdown", "pointermove", "keydown", "touchstart", "scroll"];
    events.forEach(event => document.addEventListener(event, onActivity, { passive: true }));
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      finished = true;
      window.clearInterval(timer);
      events.forEach(event => document.removeEventListener(event, onActivity));
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  return null;
}
