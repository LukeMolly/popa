import { DB } from "../../../lib/platform";

export const dynamic = "force-dynamic";

const requiredFields = ["fullName", "idNumber", "dateOfBirth", "placeOfBirth", "membershipLocation", "gender", "email", "phone"];
const fail = (error: string, status = 400) => Response.json({ error }, { status });

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    for (const key of requiredFields) {
      if (!String(form.get(key) || "").trim()) return fail("Missing " + key + ".");
    }

    const fullName = String(form.get("fullName")).trim().replace(/\s+/g, " ");
    const idNumber = String(form.get("idNumber")).trim().toUpperCase();
    const dateOfBirth = String(form.get("dateOfBirth")).trim();
    const placeOfBirth = String(form.get("placeOfBirth")).trim().replace(/\s+/g, " ");
    const membershipLocation = String(form.get("membershipLocation")).trim();
    const gender = String(form.get("gender")).trim().toLowerCase();
    const email = String(form.get("email")).trim().toLowerCase();
    const phone = String(form.get("phone")).trim().replace(/\s+/g, " ");
    const phoneDigits = phone.replace(/\D/g, "");

    if (fullName.length < 3 || fullName.length > 160 || !fullName.includes(" ")) return fail("Enter your first name and surname.");
    if (!/^[A-Za-z0-9][A-Za-z0-9/-]{4,29}$/.test(idNumber)) return fail("Enter a valid Omang or passport number.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) return fail("Choose a valid date of birth.");
    const birthDate = new Date(dateOfBirth + "T00:00:00Z");
    const now = new Date();
    if (Number.isNaN(birthDate.getTime()) || birthDate.toISOString().slice(0, 10) !== dateOfBirth ||
        birthDate > now || birthDate.getUTCFullYear() < now.getUTCFullYear() - 120) return fail("Enter a valid date of birth.");
    if (placeOfBirth.length < 2 || placeOfBirth.length > 120) return fail("Enter a valid place of birth.");
    if (membershipLocation.length < 2 || membershipLocation.length > 100) return fail("Enter a valid membership location.");
    if (!["female", "male", "other"].includes(gender)) return fail("Choose a valid gender.");
    if (email.length > 160 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("Enter a valid email address.");
    if (!/^\+?[0-9\s-]+$/.test(phone) || phoneDigits.length < 7 || phoneDigits.length > 15) return fail("Enter a valid mobile number, including its country code.");

    const parts = fullName.split(" ");
    const firstName = parts.shift() || fullName;
    const lastName = parts.join(" ");
    const membershipId = "TRFC-" + crypto.randomUUID().slice(0, 8).toUpperCase();
    const token = crypto.randomUUID();

    // KYC onboarding only: do not issue member credentials, activate a membership,
    // or create a payment submission. Existing admin review workflows stay intact.
    await DB.prepare(
      "INSERT INTO members (id,first_name,last_name,phone,email,status,expires_at,token,created_at,id_number,date_of_birth,place_of_birth,membership_location,gender) VALUES (?,?,?,?,?,'pending','',?,?,?,?,?,?,?)"
    ).bind(
      membershipId, firstName, lastName, phone, email, token, now.toISOString(),
      idNumber, dateOfBirth, placeOfBirth, membershipLocation, gender
    ).run();

    return Response.json({ membershipId }, { status: 201 });
  } catch (error) {
    console.error("KYC onboarding registration failed", error);
    const message = String(error).toLowerCase();
    if (message.includes("23505") || message.includes("duplicate key") || message.includes("unique constraint")) {
      return fail("This email address or Omang/passport number is already registered. Please contact the membership admin on WhatsApp.", 409);
    }
    return fail("Registration could not be saved. Please try again.", 500);
  }
}
