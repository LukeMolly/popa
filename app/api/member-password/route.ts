import { DB } from "../../../lib/platform";
import { getMemberSession, newPasswordRecord } from "../../../lib/member-auth";

const fail=(error:string,status=400)=>Response.json({error},{status});

export async function POST(request:Request){
  const member=await getMemberSession();
  if(!member)return fail("Sign in before changing your password.",401);
  const body=await request.json().catch(()=>null) as {password?:string;confirmPassword?:string}|null;
  const password=String(body?.password||"");
  if(password.length<8||!/[A-Za-z]/.test(password)||!/[0-9]/.test(password))return fail("Use at least 8 characters with a letter and a number.");
  if(password!==String(body?.confirmPassword||""))return fail("Passwords do not match.");
  if(password.toLowerCase()==="password")return fail("Choose a private password instead of the temporary password.");
  const record=await newPasswordRecord(password);
  await DB.prepare("UPDATE members SET password_salt=?,password_hash=?,password_must_change=FALSE WHERE id=?").bind(record.salt,record.hash,member.id).run();
  return Response.json({ok:true});
}
