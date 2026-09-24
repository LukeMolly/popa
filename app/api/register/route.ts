import { DB, deleteReceipt, uploadReceipt } from "../../../lib/platform";
import { newPasswordRecord } from "../../../lib/member-auth";
import { calculateMembershipExpiry, getMembershipSettings } from "../../../lib/membership";
import { writeAudit } from "../../../lib/audit";
import { notifyAdminsOfRegistration } from "../../../lib/email-verification";
import { PAYMENT_METHOD_CODES } from "../../../lib/payment-methods";
import { normalizePhone } from "../../../lib/phone-otp";
import { createMemberNotification } from "../../../lib/member-notifications";
const env = { DB };

export const dynamic = "force-dynamic";
const fields = ["fullName","idNumber","dateOfBirth","placeOfBirth","membershipLocation","gender","password","paymentMethod"];
const fail = (error:string,status=400) => Response.json({error},{status});
const locations=["Gaborone","Molepolole","Mochudi","Francistown","Maun","Palapye","Lobatse","Other"];
const emailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern=/^\+?[0-9][0-9\s-]{6,19}$/;
const idPattern=/^[A-Za-z0-9][A-Za-z0-9/-]{4,29}$/;
const passwordPattern=/^[A-Za-z0-9]{4}$/;

export async function POST(request:Request){
 let receiptUrl="";
 let registrationSaved=false;
 try{
  const settings=await getMembershipSettings();
  if(!settings.registrationOpen)return fail("Membership registration is currently closed.",403);
  const form=await request.formData();
  for(const key of fields) if(!String(form.get(key)||"").trim()) return fail("Missing "+key+".");

  const fullName=String(form.get("fullName")).trim().replace(/\s+/g," ");
  const idNumber=String(form.get("idNumber")).trim().toUpperCase();
  const dob=String(form.get("dateOfBirth")).trim();
  const placeOfBirth=String(form.get("placeOfBirth")).trim().replace(/\s+/g," ");
  const membershipLocation=String(form.get("membershipLocation")).trim();
  const gender=String(form.get("gender")).trim().toLowerCase();
  const accountMethod=String(form.get("accountMethod")||"email").trim().toLowerCase();
  const email=String(form.get("email")||"").trim().toLowerCase();
  const rawPhone=String(form.get("phone")||"").trim();
  const phone=rawPhone?normalizePhone(rawPhone):null;
  const password=String(form.get("password"));
  const confirmPassword=String(form.get("confirmPassword")||"");
  const paymentMethod=String(form.get("paymentMethod")||"").trim().toLowerCase();
  const paymentMethodDetail=String(form.get("paymentMethodDetail")||"").trim().slice(0,120);

  if(fullName.length<3||fullName.length>160||!fullName.includes(" "))return fail("Enter your first name and surname.");
  if(!idPattern.test(idNumber))return fail("Enter a valid Omang or passport number.");
  if(!["email","phone"].includes(accountMethod))return fail("Choose email or phone number for account opening.");
  if(accountMethod==="email"&&(!emailPattern.test(email)||email.length>160))return fail("Enter a valid email address.");
  if(accountMethod==="phone"&&!phone)return fail("Enter a valid mobile number including its country code.");
  if(email&&(!emailPattern.test(email)||email.length>160))return fail("Enter a valid email address.");
  if(!locations.includes(membershipLocation))return fail("Choose a valid membership location.");
  if(!["female","male","other"].includes(gender))return fail("Choose a valid gender.");
  if(placeOfBirth.length<2||placeOfBirth.length>120)return fail("Enter a valid place of birth.");
  if(!/^\d{4}-\d{2}-\d{2}$/.test(dob))return fail("Choose a valid date of birth.");
  const birth=new Date(dob+"T00:00:00Z"),now=new Date(),oldest=new Date(Date.UTC(now.getUTCFullYear()-120,now.getUTCMonth(),now.getUTCDate()));
  if(Number.isNaN(birth.getTime())||birth>now||birth<oldest)return fail("Date of birth must be a valid past date.");
  if(!passwordPattern.test(password))return fail("Password must be exactly 4 letters and/or numbers.");
  if(password!==confirmPassword)return fail("Passwords do not match.");
  if(!PAYMENT_METHOD_CODES.includes(paymentMethod as any))return fail("Choose FNB, Stanbic Bank or another payment method.");
  if(paymentMethod==="other"&&!paymentMethodDetail)return fail("Describe the other payment method used.");

  const duplicate=await env.DB.prepare("SELECT id,email,phone,id_number AS idNumber FROM members WHERE (email<>'' AND lower(email)=lower(?)) OR (phone<>'' AND phone=?) OR upper(id_number)=upper(?) LIMIT 1").bind(email,phone||"",idNumber).first() as {id:string;email:string;phone:string;idNumber:string}|null;
  if(duplicate){
   if(email&&duplicate.email?.toLowerCase()===email)return fail("This email address is already linked to a membership.",409);
   if(phone&&duplicate.phone===phone)return fail("This mobile number is already linked to a membership.",409);
   return fail("This Omang or passport number is already registered.",409);
  }

  const proof=form.get("proof");
  if(!(proof instanceof File)||proof.size===0)return fail("Please upload proof of payment.");
  if(proof.size>5*1024*1024)return fail("Proof of payment must be 5 MB or smaller.");
  if(!["application/pdf","image/jpeg","image/png"].includes(proof.type))return fail("Upload a PDF, JPG or PNG file.");

  const passwordRecord=await newPasswordRecord(password);
  const parts=fullName.split(" "),firstName=parts.shift()||fullName,lastName=parts.join(" ")||"—";
  const id="TRFC-"+crypto.randomUUID().slice(0,8).toUpperCase(),token=crypto.randomUUID(),createdAt=new Date(),expiresAt=calculateMembershipExpiry(settings,createdAt);
  const receiptKey="payment-proofs/"+paymentMethod+"/"+id+"/"+proof.name.replace(/[^a-zA-Z0-9._-]/g,"_");
  receiptUrl=await uploadReceipt(receiptKey,await proof.arrayBuffer(),proof.type);
  const paymentId=crypto.randomUUID();

  await env.DB.batch([
   env.DB.prepare("INSERT INTO members (id,first_name,last_name,phone,email,status,expires_at,token,created_at,id_number,date_of_birth,place_of_birth,membership_location,gender,password_salt,password_hash,password_must_change) VALUES (?,?,?,?,?,'pending',?,?,?,?,?,?,?,?,?,?,FALSE)")
    .bind(id,firstName,lastName,phone,email,expiresAt,token,createdAt.toISOString(),idNumber,dob,placeOfBirth,membershipLocation,gender,passwordRecord.salt,passwordRecord.hash),
   env.DB.prepare("INSERT INTO payments (id,member_id,amount,receipt_key,receipt_name,receipt_type,reference,status,note,created_at,reviewed_at,reviewed_by,payment_method,payment_method_detail) VALUES (?,?,?,?,?,?,?,'submitted','Registration payment',?,'','',?,?)")
    .bind(paymentId,id,settings.membershipFee,receiptUrl,proof.name.slice(0,200),proof.type,String(form.get("reference")||"").trim().slice(0,100),createdAt.toISOString(),paymentMethod,paymentMethodDetail)
  ]);

  registrationSaved=true;
  // Registration is complete once the member and payment records are stored.
  // Audit, in-app notification and email are useful follow-up services, but a
  // temporary failure in any of them must not turn a successful registration
  // into a 500 response or remove the uploaded payment proof.
  const memberForEmail={id,email,firstName,lastName,membershipLocation};
  const followUps=await Promise.allSettled([
   writeAudit({email,name:fullName,role:"member"},"member_registered","member",id,undefined,{status:"pending",membershipLocation,gender,expiresAt,paymentMethod,paymentMethodDetail},"Public registration"),
   createMemberNotification({
    memberId:id,
    title:"Registration received",
    body:"Your Township Rollers membership application has been received. Your payment proof is awaiting review by the membership office.",
    category:"membership_status",
    createdByRole:"system",
    actionRequired:false,
    status:"open"
   }),
   notifyAdminsOfRegistration(memberForEmail,settings.membershipFee)
  ]);
  followUps.forEach((result,index)=>{
   if(result.status==="rejected")console.error("Registration follow-up failed",["audit","member_notification","admin_email"][index],result.reason);
  });
  return Response.json({
   membershipId:id,
   expiresAt:new Date(expiresAt+"T23:59:59Z").toISOString(),
   membershipFee:settings.membershipFee,
   seasonName:settings.seasonName,
   emailVerificationRequired:false,
   verificationEmailSent:false
  });
 }catch(error){
  if(receiptUrl&&!registrationSaved){try{await deleteReceipt(receiptUrl)}catch{}}
  console.error("Public registration failed",error);
  const text=String(error).toLowerCase();
  if(text.includes("unique")||text.includes("23505"))return fail("This email address, mobile number or identity number is already registered.",409);
  return fail("Registration could not be saved. Please try again.",500);
 }
}
