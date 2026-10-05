import { DB } from "../../../../lib/platform";
import { issueEmailVerification } from "../../../../lib/email-verification";
import { writeAudit } from "../../../../lib/audit";

const response=()=>Response.json({ok:true,message:"If that email belongs to an unverified membership, a new verification email has been sent."});

export async function POST(request:Request){
 try{
  const body=await request.json().catch(()=>null) as {email?:string}|null;
  const email=String(body?.email||"").trim().toLowerCase();
  if(!email)return response();

  const member=await DB.prepare("SELECT id,email,first_name AS firstName,last_name AS lastName,email_verified_at AS emailVerifiedAt FROM members WHERE lower(email)=lower(?) LIMIT 1")
   .bind(email).first<{id:string;email:string;firstName:string;lastName:string;emailVerifiedAt:string}>();
  if(!member||member.emailVerifiedAt)return response();

  const recent=await DB.prepare("SELECT created_at AS createdAt FROM email_verification_tokens WHERE member_id=? ORDER BY created_at DESC LIMIT 1")
   .bind(member.id).first<{createdAt:string}>();
  if(recent&&Date.now()-new Date(recent.createdAt).getTime()<2*60*1000)return response();

  const result=await issueEmailVerification(member);
  await writeAudit({email:member.email,name:member.firstName+" "+member.lastName,role:"member"},"email_verification_resent","member",member.id,undefined,{deliveryOk:Boolean(result.ok)},"Member requested new email verification link");
  return response();
 }catch(error){
  console.error("Verification resend failed",error);
  return Response.json({error:"Could not send a verification email right now. Please try again."},{status:500});
 }
}
