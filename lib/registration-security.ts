import { DB } from "./platform";

// Vercel sets x-vercel-forwarded-for at the platform boundary; do not trust
// arbitrary client-controlled IP headers off-platform.
const rateLimitSecret = () => {
  const secret = process.env.POPA_RATE_LIMIT_SECRET || process.env.AUTH_SECRET;
  if (!secret) throw new Error("Registration rate-limit secret is not configured");
  return secret;
};

async function rateLimit(scope: string, value: string, maxAttempts: number, windowHours: number) {
  // HMAC conceals phone numbers and client IPs in the database.
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(rateLimitSecret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(scope + ":" + value));
  const clientHash = Array.from(new Uint8Array(signature), b=>b.toString(16).padStart(2,"0")).join("");
  const now = new Date();
  const current = now.toISOString();
  const resetBefore = new Date(now.getTime() - windowHours*60*60*1000).toISOString();
  const row = await DB.prepare(
    "INSERT INTO registration_rate_limits (client_hash,window_started,attempts) VALUES (?,?,1) " +
    "ON CONFLICT (client_hash) DO UPDATE SET " +
    "attempts=CASE WHEN registration_rate_limits.window_started < ? THEN 1 ELSE registration_rate_limits.attempts+1 END, " +
    "window_started=CASE WHEN registration_rate_limits.window_started < ? THEN excluded.window_started ELSE registration_rate_limits.window_started END " +
    "RETURNING attempts"
  ).bind(clientHash,current,resetBefore,resetBefore).first() as {attempts:number}|null;
  const attempts = Number(row?.attempts ?? maxAttempts+1);
  return {allowed:attempts<=maxAttempts,attempts};
}

export async function checkRegistrationRate(request: Request) {
  // Vercel provides and protects this forwarded header against IP spoofing.
  if (process.env.VERCEL !== "1") return {allowed:true,ipAttempts:0};
  const ip = request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim();
  if (!ip) return {allowed:false,ipAttempts:0}; // Fail closed if infrastructure loses the client IP.
  const result = await rateLimit("client",ip,30,1);
  return {allowed:result.allowed,ipAttempts:result.attempts};
}

export async function isPhoneRegistrationRateAllowed(phoneDigits: string) {
  // Shared family phones remain possible, but repeated signups are capped.
  return (await rateLimit("phone",phoneDigits,6,24)).allowed;
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
