import { cookies } from "next/headers";
import { DB } from "../../../lib/platform";
import { createMemberSession, MEMBER_SESSION_COOKIE, newPasswordRecord, passwordMatches, sessionTokenHash } from "../../../lib/member-auth";
const fail=(error:string,status=400)=>Response.json({error},{status});
export async function POST(request:Request){
 const body=await request.json().catch(()=>null) as {identifier?:string;email?:string;password?:string}|null;
 const raw=String(body?.identifier||body?.email||"").trim(),digits=raw.replace(/\D/g,"");
 const phone=/^(?:267)?\d{8}$/.test(digits)?digits.slice(-8):"";
 const email=phone?"":raw.toLowerCase(),loginKey=phone||email,password=String(body?.password||"");
 if(!raw||!password)return fail("Enter your email address or Botswana number and PIN.");
 if(!/^[A-Za-z0-9]{4}$/.test(password))return fail("PIN must be exactly 4 letters and/or digits.");
 if(!phone&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return fail("Enter a valid email or Botswana mobile number.");
 const now=new Date(),attempt=await DB.prepare("SELECT failed_count AS failedCount,locked_until AS lockedUntil FROM member_login_attempts WHERE email=?").bind(loginKey).first<{failedCount:number;lockedUntil:string}>();
 if(attempt?.lockedUntil&&new Date(attempt.lockedUntil)>now)return fail("Too many attempts. Try again in 15 minutes.",429);
 const member=await DB.prepare("SELECT id,password_salt AS passwordSalt,password_hash AS passwordHash,password_must_change AS passwordMustChange FROM members WHERE "+(phone?"regexp_replace(phone, '[^0-9]', '', 'g') IN (?,?)":"lower(email)=lower(?)")+" LIMIT 1").bind(...(phone?[phone,"267"+phone]:[email])).first<{id:string;passwordSalt:string;passwordHash:string;passwordMustChange:boolean}>();
 if(!member)return fail("Incorrect email/mobile or PIN.",401);
 if(!member.passwordHash||!member.passwordSalt){
  if(password!=="password")return fail("PIN setup is required. Contact the membership office.",401);
  const record=await newPasswordRecord(password);
  await DB.prepare("UPDATE members SET password_salt=?,password_hash=?,password_must_change=TRUE WHERE id=? AND (password_hash='' OR password_salt='')").bind(record.salt,record.hash,member.id).run();
  member.passwordSalt=record.salt;member.passwordHash=record.hash;member.passwordMustChange=true;
 }
 if(!(await passwordMatches(password,member.passwordSalt,member.passwordHash))){const failed=(attempt?.failedCount||0)+1,lockedUntil=failed>=5?new Date(now.getTime()+15*60*1000).toISOString():"";await DB.prepare("INSERT INTO member_login_attempts (email,failed_count,locked_until,updated_at) VALUES (?,?,?,?) ON CONFLICT(email) DO UPDATE SET failed_count=excluded.failed_count,locked_until=excluded.locked_until,updated_at=excluded.updated_at").bind(loginKey,failed,lockedUntil,now.toISOString()).run();return fail("Incorrect email/mobile or PIN.",401)}
 await DB.prepare("DELETE FROM member_login_attempts WHERE email=?").bind(loginKey).run();const session=await createMemberSession(member.id);(await cookies()).set(MEMBER_SESSION_COOKIE,session.token,{httpOnly:true,secure:true,sameSite:"lax",path:"/",expires:session.expires});return Response.json({ok:true,mustChangePassword:Boolean(member.passwordMustChange)});
}
export async function DELETE(){const store=await cookies(),token=store.get(MEMBER_SESSION_COOKIE)?.value;if(token)await DB.prepare("DELETE FROM member_sessions WHERE token_hash=?").bind(sessionTokenHash(token)).run();store.set(MEMBER_SESSION_COOKIE,"",{httpOnly:true,secure:true,sameSite:"lax",path:"/",maxAge:0});return Response.json({ok:true})}
