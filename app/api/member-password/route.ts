import { DB } from "../../../lib/platform";
import { getMemberSession, newPasswordRecord } from "../../../lib/member-auth";
import { writeAudit } from "../../../lib/audit";

const fail=(error:string,status=400)=>Response.json({error},{status});
const passwordPattern=/^[A-Za-z0-9]{4}$/;

export async function POST(request:Request){
  const member=await getMemberSession();
  if(!member)return fail("Sign in before changing your password.",401);
  const body=await request.json().catch(()=>null) as {password?:string;confirmPassword?:string}|null;
  const password=String(body?.password||"");
  if(!passwordPattern.test(password))return fail("Password must be exactly 4 letters and/or numbers.");
  if(password!==String(body?.confirmPassword||""))return fail("Passwords do not match.");
  const record=await newPasswordRecord(password);
  await DB.prepare("UPDATE members SET password_salt=?,password_hash=?,password_must_change=FALSE WHERE id=?").bind(record.salt,record.hash,member.id).run();
  await writeAudit({email:member.email,name:member.firstName+" "+member.lastName,role:"member"},"password_changed","member",member.id,undefined,{passwordChanged:true},"Member changed password");
  return Response.json({ok:true});
}
