import { cookies } from "next/headers";
import { DB } from "../../../lib/platform";
import { createMemberSession, MEMBER_SESSION_COOKIE, newPasswordRecord, passwordMatches, sessionTokenHash } from "../../../lib/member-auth";
const fail=(error:string,status=400)=>Response.json({error},{status});
export async function POST(request:Request){
 const body=await request.json().catch(()=>null) as {email?:string;password?:string}|null,email=String(body?.email||"").trim().toLowerCase(),password=String(body?.password||"");
 if(!email||!password)return fail("Enter your email address and password.");
 const now=new Date(),attempt=await DB.prepare("SELECT failed_count AS failedCount,locked_until AS lockedUntil FROM member_login_attempts WHERE email=?").bind(email).first<{failedCount:number;lockedUntil:string}>();
 if(attempt?.lockedUntil&&new Date(attempt.lockedUntil)>now)return fail("Too many attempts. Try again in 15 minutes.",429);
 const member=await DB.prepare("SELECT id,password_salt AS passwordSalt,password_hash AS passwordHash,password_must_change AS passwordMustChange FROM members WHERE lower(email)=lower(?) LIMIT 1").bind(email).first<{id:string;passwordSalt:string;passwordHash:string;passwordMustChange:boolean}>();
 if(!member)return fail("No membership account exists for this email.",401);
 if(!member.passwordHash||!member.passwordSalt){
  if(password!=="password")return fail("Use the temporary password supplied by the membership office.",401);
  const record=await newPasswordRecord(password);
  await DB.prepare("UPDATE members SET password_salt=?,password_hash=?,password_must_change=TRUE WHERE id=? AND (password_hash='' OR password_salt='')").bind(record.salt,record.hash,member.id).run();
  member.passwordSalt=record.salt;member.passwordHash=record.hash;member.passwordMustChange=true;
 }
 if(!(await passwordMatches(password,member.passwordSalt,member.passwordHash))){const failed=(attempt?.failedCount||0)+1,lockedUntil=failed>=5?new Date(now.getTime()+15*60*1000).toISOString():"";await DB.prepare("INSERT INTO member_login_attempts (email,failed_count,locked_until,updated_at) VALUES (?,?,?,?) ON CONFLICT(email) DO UPDATE SET failed_count=excluded.failed_count,locked_until=excluded.locked_until,updated_at=excluded.updated_at").bind(email,failed,lockedUntil,now.toISOString()).run();return fail("Incorrect email address or password.",401)}
 await DB.prepare("DELETE FROM member_login_attempts WHERE email=?").bind(email).run();const session=await createMemberSession(member.id);(await cookies()).set(MEMBER_SESSION_COOKIE,session.token,{httpOnly:true,secure:true,sameSite:"lax",path:"/",expires:session.expires});return Response.json({ok:true,mustChangePassword:Boolean(member.passwordMustChange)});
}
export async function DELETE(){const store=await cookies(),token=store.get(MEMBER_SESSION_COOKIE)?.value;if(token)await DB.prepare("DELETE FROM member_sessions WHERE token_hash=?").bind(sessionTokenHash(token)).run();store.set(MEMBER_SESSION_COOKIE,"",{httpOnly:true,secure:true,sameSite:"lax",path:"/",maxAge:0});return Response.json({ok:true})}
