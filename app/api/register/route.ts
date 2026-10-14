import { DB, deleteReceipt, uploadReceipt } from "../../../lib/platform";

export const dynamic = "force-dynamic";

const requiredFields = ["fullName", "idNumber", "dateOfBirth", "placeOfBirth", "membershipLocation", "gender", "email", "phone"];
const fail = (error: string, status = 400) => Response.json({ error }, { status });
const maxProofSize = 5 * 1024 * 1024;
const proofTypes = ["application/pdf", "image/jpeg", "image/png"];

function validProofSignature(bytes: Uint8Array, type: string) {
  if (type === "application/pdf") return bytes.length >= 5 && [37, 80, 68, 70, 45].every((byte, index) => bytes[index] === byte);
  if (type === "image/jpeg") return bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (type === "image/png") return bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte);
  return false;
}

export async function POST(request: Request) {
  let receiptUrl = "";
  try {
    const form = await request.formData();
    const proof = form.get("proof");
    const hasProof = proof instanceof File && proof.size > 0;
    if (hasProof && (proof.size > maxProofSize || !proofTypes.includes(proof.type))) {
      return fail("POP attachment must be a PDF, JPG or PNG file of 5 MB or less.");
    }
    let proofBuffer: ArrayBuffer | undefined;
    if (hasProof) {
      proofBuffer = await proof.arrayBuffer();
      if (!validProofSignature(new Uint8Array(proofBuffer), proof.type)) {
        return fail("The POP attachment is not a valid PDF, JPG or PNG file.");
      }
    }
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

    // Members are still onboarded as pending without credentials.
    // If POP was attached, create one existing payment-review row atomically
    // with the member registration, leaving the admin portal unchanged.
    const insertMember =
      "INSERT INTO members (id,first_name,last_name,phone,email,status,expires_at,token,created_at,id_number,date_of_birth,place_of_birth,membership_location,gender) " +
      "VALUES (?,?,?,?,?,'pending','',?,?,?,?,?,?,?)";
    const memberArgs = [
      membershipId, firstName, lastName, phone, email, token, now.toISOString(),
      idNumber, dateOfBirth, placeOfBirth, membershipLocation, gender
    ];

    if (hasProof && proofBuffer) {
      const filename = proof.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100) || "proof";
      const receiptName = proof.name.slice(0, 200);
      receiptUrl = await uploadReceipt("payment-proofs/kyc/" + membershipId + "/" + filename, proofBuffer, proof.type);
      await DB.prepare(
        "WITH member_insert AS (" + insertMember + " RETURNING id) " +
        "INSERT INTO payments (id,member_id,amount,receipt_key,receipt_name,receipt_type,reference,status,note,created_at,reviewed_at) " +
        "SELECT ?,id,200,?,?,?,'','submitted',?,?,' ' FROM member_insert"
      ).bind(
        ...memberArgs,
        crypto.randomUUID(), receiptUrl, receiptName, proof.type,
        "POP attached during KYC onboarding; pending administrator verification",
        now.toISOString()
      ).run();
    } else {
      await DB.prepare(insertMember).bind(...memberArgs).run();
    }

    return Response.json({ membershipId, firstName, proofUploaded: hasProof }, { status: 201 });
  } catch (error) {
    if (receiptUrl) {
      try { await deleteReceipt(receiptUrl); }
      catch (cleanupError) { console.error("Could not clean up unattached POP", cleanupError); }
    }
    console.error("KYC onboarding registration failed", error);
    const message = String(error).toLowerCase();
    if (message.includes("23505") || message.includes("duplicate key") || message.includes("unique constraint")) {
      return fail("This email address or Omang/passport number is already registered. Please contact the membership admin on WhatsApp.", 409);
    }
    return fail("Registration could not be saved. Please try again.", 500);
  }
}
