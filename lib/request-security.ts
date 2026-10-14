// Protect cookie-authenticated mutations against cross-site form submissions.
// Browsers include Origin on unsafe requests; Fetch Metadata is defence in depth.
export function isTrustedWrite(request: Request): boolean {
  try {
    if (request.headers.get("sec-fetch-site") === "cross-site") return false;
    const origin = request.headers.get("origin");
    if (!origin) return true; // Non-browser clients may legitimately omit Origin.
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}
export const writeDenied = () => Response.json(
  { error: "Cross-site submissions are not permitted." },
  { status: 403, headers: { "Cache-Control": "no-store" } },
);
