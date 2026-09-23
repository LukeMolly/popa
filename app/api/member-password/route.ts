import { DB } from "../../../lib/platform";
import { getMemberSession, newPasswordRecord } from "../../../lib/member-auth";
import { verifyPhoneOtp } from "../../../lib/phone-otp";
import { writeAudit } from "../../../lib/audit";

const fail=(error:string,status=400)=>Response.json({error},{status});
const passwordPattern=/^[A-Za-z0-9]{4}$/;

export async function POST(request:Request){
 const member=await getMemberSession();
 if(!member)return fail("Sign in before changing your PIN.",401);
 const body=await request.json().catch(()=>null) as {password?:string;confirmPassword?:string;otp?:string}|null;
 const password=String(body?.password||"");
 if(!passwordPattern.test(password))return fail("PIN must be exactly 4 letters and/or numbers.");
 if(password!==String(body?.confirmPassword||""))return fail("PINs do not match.");

 if(!member.passwordMustChange){
  const contact=await DB.prepare("SELECT phone,phone_verified_at AS phoneVerifiedAt FROM members WHERE id=?").bind(member.id).first<{phone:string;phoneVerifiedAt:string}>();
  if(!contact?.phone||!contact.phoneVerifiedAt)return fail("Verify your mobile number before customizing your PIN.",403);
  const verified=await verifyPhoneOtp(contact.phone,String(body?.otp||""));
  if(!verified.ok)return fail(verified.error,403);
 }

 const record=await newPasswordRecord(password);
 await DB.prepare("UPDATE members SET password_salt=?,password_hash=?,password_must_change=FALSE WHERE id=?").bind(record.salt,record.hash,member.id).run();
 await writeAudit({email:member.email,name:member.firstName+" "+member.lastName,role:"member"},"password_changed","member",member.id,undefined,{passwordChanged:true,otpRequired:!member.passwordMustChange},"Member changed PIN");
 return Response.json({ok:true});
}
