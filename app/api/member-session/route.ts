import { cookies } from "next/headers";
import { DB } from "../../../lib/platform";
import { createMemberSession, MEMBER_SESSION_COOKIE, passwordMatches, sessionTokenHash } from "../../../lib/member-auth";
const fail=(error:string,status=400)=>Response.json({error},{status});

export async function POST(request:Request){
 const body=await request.json().catch(()=>null) as {email?:string;password?:string}|null;
 const email=String(body?.email||"").trim().toLowerCase(),password=String(body?.password||"");
 if(!email||!password)return fail("Enter your email address and password.");
 if(!/^[A-Za-z0-9]{4}$/.test(password))return fail("Password must be 4 letters and/or numbers.");

 const now=new Date(),attempt=await DB.prepare("SELECT failed_count AS failedCount,locked_until AS lockedUntil FROM member_login_attempts WHERE email=?").bind(email).first<{failedCount:number;lockedUntil:string}>();
 if(attempt?.lockedUntil&&new Date(attempt.lockedUntil)>now)return fail("Too many attempts. Try again in 15 minutes.",429);

 const member=await DB.prepare("SELECT id,password_salt AS passwordSalt,password_hash AS passwordHash,password_must_change AS passwordMustChange,email_verified_at AS emailVerifiedAt FROM members WHERE lower(email)=lower(?) LIMIT 1").bind(email).first<{id:string;passwordSalt:string;passwordHash:string;passwordMustChange:boolean;emailVerifiedAt:string}>();
 if(!member)return fail("Incorrect email address or password.",401);
 if(!member.passwordHash||!member.passwordSalt)return fail("Password setup is required. Use Forgot password to request recovery.",401);
 if(!member.emailVerifiedAt)return Response.json({error:"Verify your email address before signing in.",needsVerification:true},{status:403});

 if(!(await passwordMatches(password,member.passwordSalt,member.passwordHash))){
  const failed=(attempt?.failedCount||0)+1,lockedUntil=failed>=5?new Date(now.getTime()+15*60*1000).toISOString():"";
  await DB.prepare("INSERT INTO member_login_attempts (email,failed_count,locked_until,updated_at) VALUES (?,?,?,?) ON CONFLICT(email) DO UPDATE SET failed_count=excluded.failed_count,locked_until=excluded.locked_until,updated_at=excluded.updated_at").bind(email,failed,lockedUntil,now.toISOString()).run();
  return fail("Incorrect email address or password.",401);
 }
 await DB.prepare("DELETE FROM member_login_attempts WHERE email=?").bind(email).run();
 const session=await createMemberSession(member.id);
 (await cookies()).set(MEMBER_SESSION_COOKIE,session.token,{httpOnly:true,secure:true,sameSite:"lax",path:"/",expires:session.expires});
 return Response.json({ok:true,mustChangePassword:Boolean(member.passwordMustChange)});
}
export async function DELETE(){
 const store=await cookies(),token=store.get(MEMBER_SESSION_COOKIE)?.value;
 if(token)await DB.prepare("DELETE FROM member_sessions WHERE token_hash=?").bind(sessionTokenHash(token)).run();
 store.set(MEMBER_SESSION_COOKIE,"",{httpOnly:true,secure:true,sameSite:"lax",path:"/",maxAge:0});
 return Response.json({ok:true});
}
