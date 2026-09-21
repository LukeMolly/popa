import { DB, deleteReceipt, uploadReceipt } from "../../../lib/platform";
import { newPasswordRecord } from "../../../lib/member-auth";
const env = { DB };

export const dynamic = "force-dynamic";
const fields = ["fullName","idNumber","dateOfBirth","placeOfBirth","membershipLocation","gender","email","phone","password"];
const fail = (error:string,status=400) => Response.json({error},{status});

export async function POST(request:Request){
 try{
  const form=await request.formData();
  for(const key of fields) if(!String(form.get(key)||"").trim()) return fail(`Missing ${key}.`);
  const proof=form.get("proof");
  if(!(proof instanceof File)||proof.size===0) return fail("Please upload proof of payment.");
  if(proof.size>5*1024*1024) return fail("Proof of payment must be 5 MB or smaller.");
  if(!["application/pdf","image/jpeg","image/png"].includes(proof.type)) return fail("Upload a PDF, JPG or PNG file.");
  const fullName=String(form.get("fullName")).trim().replace(/\s+/g," ");
  const password=String(form.get("password"));
  if(password.length<8||!/[A-Za-z]/.test(password)||!/[0-9]/.test(password)) return fail("Use at least 8 characters with a letter and a number.");
  if(password!==String(form.get("confirmPassword")||"")) return fail("Passwords do not match.");
  const passwordRecord=await newPasswordRecord(password);
  const parts=fullName.split(" "),firstName=parts.shift()||fullName,lastName=parts.join(" ")||"—";
  const id="TRFC-"+crypto.randomUUID().slice(0,8).toUpperCase(),token=crypto.randomUUID(),now=new Date(),expiresAt="2027-07-31";
  const receiptKey=`payment-proofs/${id}/${proof.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`;
  const receiptUrl=await uploadReceipt(receiptKey,await proof.arrayBuffer(),proof.type);
  try { await env.DB.batch([
   env.DB.prepare("INSERT INTO members (id,first_name,last_name,phone,email,status,expires_at,token,created_at,id_number,date_of_birth,place_of_birth,membership_location,gender,password_salt,password_hash) VALUES (?,?,?,?,?,'pending',?,?,?,?,?,?,?,?,?,?)").bind(id,firstName,lastName,String(form.get("phone")).trim(),String(form.get("email")).trim().toLowerCase(),expiresAt,token,now.toISOString(),String(form.get("idNumber")).trim(),String(form.get("dateOfBirth")),String(form.get("placeOfBirth")).trim(),String(form.get("membershipLocation")),String(form.get("gender")),passwordRecord.salt,passwordRecord.hash),
   env.DB.prepare("INSERT INTO payments (id,member_id,amount,receipt_key,receipt_name,receipt_type,reference,status,note,created_at,reviewed_at) VALUES (?,?,200,?,?,?,'','submitted','Registration payment',?,'')").bind(crypto.randomUUID(),id,receiptUrl,proof.name,proof.type,now.toISOString())
  ]); } catch(error) { await deleteReceipt(receiptUrl); throw error; }
  return Response.json({membershipId:id,expiresAt:new Date(expiresAt+"T23:59:59Z").toISOString()});
 }catch(error){
  console.error("Public registration failed",error);
  const message=error instanceof Error&&error.message.includes("UNIQUE")?"This identity number is already registered.":"Registration could not be saved. Please try again.";
  return fail(message,error instanceof Error&&error.message.includes("UNIQUE")?409:500);
 }
}
