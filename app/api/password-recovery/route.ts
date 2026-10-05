import { DB } from "../../../lib/platform";
import { writeAudit } from "../../../lib/audit";
import { emailAdminsPasswordRecovery } from "../../../lib/account-emails";

const generic=()=>Response.json({ok:true,message:"If the details match a membership, a recovery request has been sent to the membership office."});

export async function POST(request:Request){
 try{
  const body=await request.json().catch(()=>null) as {email?:string;memberId?:string}|null;
  const email=String(body?.email||"").trim().toLowerCase();
  const memberId=String(body?.memberId||"").trim().toUpperCase();
  if(!email||!memberId)return generic();

  const member=await DB.prepare("SELECT id,first_name AS firstName,last_name AS lastName,email FROM trfc_bootstrap_recovery_member(?,?)").bind(memberId,email).first() as {id:string;firstName:string;lastName:string;email:string}|null;
  if(!member)return generic();

  const now=new Date(),recent=await DB.prepare("SELECT id,requested_at AS requestedAt FROM trfc_bootstrap_recovery_recent(?)").bind(member.id).first() as {id:string;requestedAt:string}|null;
  if(recent&&Date.now()-new Date(recent.requestedAt).getTime()<10*60*1000)return generic();

  const id=crypto.randomUUID();
  await DB.prepare("SELECT trfc_bootstrap_recovery_create(?,?,?,?)").bind(id,member.id,email,now.toISOString()).run();
  await writeAudit({email,name:member.firstName+" "+member.lastName,role:"member"},"password_recovery_requested","member",member.id,undefined,{requestId:id},"Member requested password recovery");
  await emailAdminsPasswordRecovery(member);
  return generic();
 }catch(error){
  console.error("Password recovery request failed",error);
  return generic();
 }
}
