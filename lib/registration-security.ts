import { DB } from "./platform";

// Vercel sets x-vercel-forwarded-for at the platform boundary; do not trust
// arbitrary client-controlled IP headers off-platform.
export async function isRegistrationRateAllowed(request: Request): Promise<boolean> {
  if (process.env.VERCEL !== "1") return true;
  const ip = request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim();
  if (!ip) return true;
  const pepper = process.env.AUTH_SECRET || process.env.POPA_RATE_LIMIT_SECRET || "";
  const raw = new TextEncoder().encode("POPA registration:" + pepper + ":" + ip);
  const hashed = await crypto.subtle.digest("SHA-256", raw);
  const hash = Array.from(new Uint8Array(hashed), b => b.toString(16).padStart(2, "0")).join("");
  const now = new Date();
  const current = now.toISOString();
  const resetBefore = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  // One atomic database upsert avoids per-process counters and most concurrency races.
  const count = await DB.prepare(
    "INSERT INTO registration_rate_limits (client_hash,window_started,attempts) VALUES (?,?,1) " +
    "ON CONFLICT (client_hash) DO UPDATE SET " +
    "attempts=CASE WHEN registration_rate_limits.window_started < ? THEN 1 ELSE registration_rate_limits.attempts+1 END, " +
    "window_started=CASE WHEN registration_rate_limits.window_started < ? THEN excluded.window_started ELSE registration_rate_limits.window_started END " +
    "RETURNING attempts"
  ).bind(hash, current, resetBefore, resetBefore).first() as {attempts:number}|null;
  return Number(count?.attempts ?? 101) <= 100;
}

const maxRequestSize = 5 * 1024 * 1024 + 96 * 1024;
export async function readLimitedRegistrationForm(request: Request): Promise<FormData> {
  const contentType = request.headers.get("content-type") || "";
  if (!/^multipart\/form-data\s*;/i.test(contentType)) {
    throw new TypeError("KYC submissions must use multipart form data.");
  }
  const declaredSize = Number(request.headers.get("content-length") || 0);
  if (declaredSize > maxRequestSize) throw new RangeError("Upload exceeds the 5 MB limit.");
  const reader = request.body?.getReader();
  if (!reader) throw new TypeError("KYC submission body is empty.");
  let total = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxRequestSize) {
      await reader.cancel().catch(() => {});
      throw new RangeError("Upload exceeds the 5 MB limit.");
    }
    chunks.push(value);
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new Request("https://registration.internal", {
    method: "POST",
    headers: { "Content-Type": contentType },
    body: body.buffer,
  }).formData();
}
