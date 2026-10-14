import { DB, deleteReceipt, uploadReceipt } from "../../../lib/platform";
import { PAYMENT_METHOD_CODES, paymentMethodLabel } from "../../../lib/payment-methods";
import { isTrustedWrite, writeDenied } from "../../../lib/request-security";
import { checkRegistrationRate, isPhoneRegistrationRateAllowed, readLimitedRegistrationForm } from "../../../lib/registration-security";

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
  if (!isTrustedWrite(request)) return writeDenied();
  let receiptUrl = "";
  try {
    const assessment = await checkRegistrationRate(request);
    if (!assessment.allowed) {
      return Response.json({ error: "Too many registration attempts. Please try again later." }, {
        status: 429, headers: { "Retry-After": "3600", "Cache-Control": "no-store" },
      });
    }
    const form = await readLimitedRegistrationForm(request);
    // An off-screen field traps basic automated form fillers without changing the visible UX.
    if (String(form.get("companyWebsite") || "").trim()) {
      return fail("Registration could not be submitted. Please retry.",400);
    }
    const paymentMethod = String(form.get("paymentMethod") || "").trim().toLowerCase();
    const paymentMethodDetail = String(form.get("paymentMethodDetail") || "").trim().slice(0, 120);
    const reference = String(form.get("reference") || "").trim().slice(0, 100);
    if (paymentMethod && !PAYMENT_METHOD_CODES.includes(paymentMethod as (typeof PAYMENT_METHOD_CODES)[number])) {
      return fail("Select a valid banking or payment method.");
    }
    if (paymentMethod === "other" && !paymentMethodDetail) {
      return fail("Specify the other payment method.");
    }
    const proof = form.get("proof");
    const hasProof = proof instanceof File && proof.size > 0;
    if (hasProof && !paymentMethod) return fail("Choose the bank or payment method used for the attached POP.");
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
    const requestedDocumentType = String(form.get("documentType") || "").trim().toLowerCase();
    // Legacy clients can omit documentType; modern forms make the distinction explicit.
    const documentType = requestedDocumentType || (/^[0-9]{9}$/.test(idNumber) ? "omang" : "passport");
    const dateOfBirth = String(form.get("dateOfBirth")).trim();
    const placeOfBirth = String(form.get("placeOfBirth")).trim().replace(/\s+/g, " ");
    const membershipLocation = String(form.get("membershipLocation")).trim();
    const gender = String(form.get("gender")).trim().toLowerCase();
    const email = String(form.get("email")).trim().toLowerCase();
    // The form submits exactly eight national digits; +267 is supplied by the server.
    const localPhone = String(form.get("phone") || "").trim();
    const phone = "+267" + localPhone;
    const phoneDigits = "267" + localPhone;

    if (fullName.length < 3 || fullName.length > 160 || !fullName.includes(" ")) return fail("Enter your first name and surname.");
    if (!["omang", "passport"].includes(documentType)) return fail("Choose Omang or passport.");
    if (documentType === "omang" && !/^[0-9]{9}$/.test(idNumber)) return fail("Omang must contain exactly nine digits.");
    if (documentType === "passport" && !/^[A-Za-z0-9][A-Za-z0-9/-]{4,29}$/.test(idNumber)) return fail("Enter a valid passport number.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) return fail("Choose a valid date of birth.");
    const birthDate = new Date(dateOfBirth + "T00:00:00Z");
    const now = new Date();
    if (Number.isNaN(birthDate.getTime()) || birthDate.toISOString().slice(0, 10) !== dateOfBirth ||
        birthDate > now || birthDate.getUTCFullYear() < now.getUTCFullYear() - 120) return fail("Enter a valid date of birth.");
    if (placeOfBirth.length < 2 || placeOfBirth.length > 120) return fail("Enter a valid place of birth.");
    if (membershipLocation.length < 2 || membershipLocation.length > 100) return fail("Enter a valid membership location.");
    if (!["female", "male", "other"].includes(gender)) return fail("Choose a valid gender.");
    if (email.length > 160 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("Enter a valid email address.");
    if (!/^[0-9]{8}$/.test(localPhone)) return fail("Enter exactly eight digits for your Botswana mobile number.");
    if (!(await isPhoneRegistrationRateAllowed(phoneDigits))) {
      return Response.json({error:"Too many recent attempts using this mobile number. Please contact the membership administrator."},{
        status:429,headers:{"Retry-After":"86400","Cache-Control":"no-store"}
      });
    }
    const duplicatePhone = await DB.prepare(
      "SELECT COUNT(*)::int AS count FROM members WHERE regexp_replace(phone,'[^0-9]','','g') IN (?,?)"
    ).bind(localPhone,phoneDigits).first() as {count:number}|null;
    const riskReasons:string[] = [];
    if (Number(duplicatePhone?.count ?? 0)>0) riskReasons.push("Phone number shared with another registration");
    if (assessment.ipAttempts>=10) riskReasons.push("Unusually rapid submissions from one network");
    if (/^(?:test|testing|fake|dummy|asdf|qwerty)(?:\s|$)/i.test(fullName)) riskReasons.push("Placeholder-style name");
    // Omang encodes sex in its fifth digit: 1 male, 2 female.
    // Passport numbers are not assessed; 'other' is explicitly exempt.
    if (documentType === "omang" && gender !== "other" &&
        idNumber[4] !== (gender === "female" ? "2" : "1")) {
      riskReasons.push("Omang fifth digit does not match the selected gender");
    }
    const riskStatus=riskReasons.length?"flagged":"none";

    const parts = fullName.split(" ");
    const firstName = parts.shift() || fullName;
    const lastName = parts.join(" ");
    const membershipId = "TRFC-" + crypto.randomUUID().slice(0, 8).toUpperCase();
    const token = crypto.randomUUID();

    // KYC registration stays account-free and pending. Payments use the existing
    // admin-visible table. Pay-later members are not counted as submitted payments.
    const insertMember =
      "INSERT INTO members (id,first_name,last_name,phone,email,status,expires_at,token,created_at,id_number,date_of_birth,place_of_birth,membership_location,gender,risk_status,risk_reasons) " +
      "VALUES (?,?,?,?,?,'pending','',?,?,?,?,?,?,?,?,?)";
    const memberArgs = [
      membershipId, firstName, lastName, phone, email, token, now.toISOString(),
      idNumber, dateOfBirth, placeOfBirth, membershipLocation, gender, riskStatus, riskReasons.join("; ")
    ];

    if (paymentMethod) {
      let receiptName = "";
      let receiptType = "";
      if (hasProof && proofBuffer) {
        const filename = proof.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100) || "proof";
        receiptName = proof.name.slice(0, 200);
        receiptType = proof.type;
        receiptUrl = await uploadReceipt("payment-proofs/kyc/" + membershipId + "/" + filename, proofBuffer, proof.type);
      }
      const note = "Payment method: " + paymentMethodLabel(paymentMethod, paymentMethodDetail) +
        "; POP: " + (hasProof ? "attached during KYC onboarding" : "awaiting proof from member");
      // One SQL statement guarantees the member and payment enter the admin tally together.
      await DB.prepare(
        "WITH member_insert AS (" + insertMember + " RETURNING id) " +
        "INSERT INTO payments (id,member_id,amount,receipt_key,receipt_name,receipt_type,reference,status,note,created_at,reviewed_at) " +
        "SELECT ?,id,200,?,?,?,?,'submitted',?,?,' ' FROM member_insert"
      ).bind(
        ...memberArgs,
        crypto.randomUUID(), receiptUrl, receiptName, receiptType, reference, note,
        now.toISOString()
      ).run();
    } else {
      await DB.prepare(insertMember).bind(...memberArgs).run();
    }

    return Response.json({ membershipId, firstName, proofUploaded: hasProof }, { status: 201 });
  } catch (error) {
    // Always clear orphaned private uploads, regardless of the error type.
    if (receiptUrl) {
      try { await deleteReceipt(receiptUrl); }
      catch (cleanupError) { console.error("Could not clean up unattached POP", cleanupError); }
    }
    if (error instanceof RangeError) return fail("POP attachment and registration must be within the 5 MB upload limit.", 413);
    if (error instanceof TypeError && !receiptUrl) return fail("Invalid registration form data.");
    console.error("KYC onboarding registration failed", error);
    const message = String(error).toLowerCase();
    if (message.includes("23505") || message.includes("duplicate key") || message.includes("unique constraint")) {
      return fail("This email address or Omang/passport number is already registered. Please contact the membership admin on WhatsApp.", 409);
    }
    return fail("Registration could not be saved. Please try again.", 500);
  }
}
