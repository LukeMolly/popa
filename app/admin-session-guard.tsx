"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const ADMIN_IDLE_MS = 3 * 60 * 1000;

export default function AdminSessionGuard() {
  const timer = useRef<number | null>(null);
  const pathname = usePathname();
  const previousPath = useRef(pathname);
  const signingOut = useRef(false);

  useEffect(() => {
    const signOut = async () => {
      if (signingOut.current) return;
      signingOut.current = true;
      try {
        await fetch("/api/admin-pin", {
          method: "DELETE",
          credentials: "same-origin",
          cache: "no-store",
          keepalive: true,
        });
      } finally {
        location.replace("/admin-login");
      }
    };

    const resetIdle = () => {
      if (signingOut.current) return;
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void signOut(), ADMIN_IDLE_MS);
    };

    if (previousPath.current !== pathname) {
      previousPath.current = pathname;
      void signOut();
      return;
    }

    const leaveAdmin = () => {
      if (document.visibilityState === "hidden") void signOut();
    };

    const events: Array<keyof WindowEventMap> = ["pointerdown", "keydown", "scroll", "touchstart"];
    events.forEach((event) => window.addEventListener(event, resetIdle, { passive: true }));
    document.addEventListener("visibilitychange", leaveAdmin);
    resetIdle();

    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
      events.forEach((event) => window.removeEventListener(event, resetIdle));
      document.removeEventListener("visibilitychange", leaveAdmin);
    };
  }, [pathname]);

  return null;
}
