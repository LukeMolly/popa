"use client";

// A purely visual, short-lived first-name greeting. Neither key is a login
// credential; administrator access is always enforced by server-side sessions.
const ACTIVE_NAME_KEY = "popa-admin-greeting-pending";
const SIGNED_OUT_NAME_KEY = "popa-admin-greeting-signed-out";
const GREETING_DURATION_MS = 3 * 60 * 1000;

function firstName(value: string) {
  return value.trim().split(/\s+/)[0]?.slice(0, 48) || "";
}

export function rememberAdminFirstName(value: string) {
  const name = firstName(value);
  if (!name) return;
  try {
    sessionStorage.removeItem(SIGNED_OUT_NAME_KEY);
    sessionStorage.setItem(ACTIVE_NAME_KEY, name);
  } catch {
    // Browser storage can be unavailable in private or hardened contexts.
  }
}

export function confirmSignedOutGreeting() {
  try {
    const name = firstName(sessionStorage.getItem(ACTIVE_NAME_KEY) || "");
    sessionStorage.removeItem(ACTIVE_NAME_KEY);
    sessionStorage.removeItem(SIGNED_OUT_NAME_KEY);
    if (!name) return;
    sessionStorage.setItem(
      SIGNED_OUT_NAME_KEY,
      JSON.stringify({ name, expiresAt: Date.now() + GREETING_DURATION_MS }),
    );
  } catch {
    // The sign-out must succeed even when visual preferences cannot be stored.
  }
}

export function readSignedOutGreeting(): string | null {
  try {
    const saved = sessionStorage.getItem(SIGNED_OUT_NAME_KEY);
    if (!saved) return null;
    const parsed = JSON.parse(saved) as { name?: unknown; expiresAt?: unknown };
    if (
      typeof parsed.name !== "string" ||
      typeof parsed.expiresAt !== "number" ||
      parsed.expiresAt <= Date.now()
    ) {
      sessionStorage.removeItem(SIGNED_OUT_NAME_KEY);
      return null;
    }
    return firstName(parsed.name) || null;
  } catch {
    return null;
  }
}
