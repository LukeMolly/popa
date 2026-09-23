import { cookies } from "next/headers";
import { DB } from "../../../lib/platform";
import { createMemberSession, MEMBER_SESSION_COOKIE, passwordMatches, sessionTokenHash } from "../../../lib/member-auth";
import { normalizeBotswanaPhone } from "../../../lib/phone-otp";

const fail=(error:string,status=400)=>Response.json({error},{status});

export async function POST(request:Request){
 const body=await request.json().catch(()=>null) as {identifier?:string;email?:string;password?:string}|null;
 const rawIdentifier=String(body?.identifier||body?.email||"").trim();
 const password=String(body?.password||"");
 const phone=normalizeBotswanaPhone(rawIdentifier);
 const email=phone?"":rawIdentifier.toLowerCase();
 if(!rawIdentifier||!password)return fail("Enter your email address or mobile number and 4-character PIN.");
 if(!/^[A-Za-z0-9]{4}$/.test(password))return fail("PIN must be exactly 4 letters and/or numbers.");
 if(!phone&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return fail("Enter a valid email address or Botswana mobile number.");

 const loginKey=phone||email;
 const now=new Date();
 const attempt=await DB.prepare("SELECT failed_count AS failedCount,locked_until AS lockedUntil FROM member_login_attempts WHERE email=?").bind(loginKey).first<{failedCount:number;lockedUntil:string}>();
 if(attempt?.lockedUntil&&new Date(attempt.lockedUntil)>now)return fail("Too many attempts. Try again in 15 minutes.",429);

 const member=phone
  ?await DB.prepare("SELECT id,password_salt AS passwordSalt,password_hash AS passwordHash,password_must_change AS passwordMustChange,email_verified_at AS emailVerifiedAt,phone_verified_at AS phoneVerifiedAt FROM members WHERE phone=? LIMIT 1").bind(phone).first<{id:string;passwordSalt:string;passwordHash:string;passwordMustChange:boolean;emailVerifiedAt:string;phoneVerifiedAt:string}>()
  :await DB.prepare("SELECT id,password_salt AS passwordSalt,password_hash AS passwordHash,password_must_change AS passwordMustChange,email_verified_at AS emailVerifiedAt,phone_verified_at AS phoneVerifiedAt FROM members WHERE lower(email)=lower(?) LIMIT 1").bind(email).first<{id:string;passwordSalt:string;passwordHash:string;passwordMustChange:boolean;emailVerifiedAt:string;phoneVerifiedAt:string}>();

 if(!member)return fail("Incorrect email/mobile number or PIN.",401);
 if(!member.passwordHash||!member.passwordSalt)return fail("PIN setup is required. Use Forgot password to request recovery.",401);
 if(phone&&!member.phoneVerifiedAt)return Response.json({error:"Verify your phone number before signing in.",needsPhoneVerification:true},{status:403});
 if(!phone&&!member.emailVerifiedAt)return Response.json({error:"Verify your email address before signing in.",needsVerification:true},{status:403});

 if(!(await passwordMatches(password,member.passwordSalt,member.passwordHash))){
  const failed=(attempt?.failedCount||0)+1,lockedUntil=failed>=5?new Date(now.getTime()+15*60*1000).toISOString():"";
  await DB.prepare("INSERT INTO member_login_attempts (email,failed_count,locked_until,updated_at) VALUES (?,?,?,?) ON CONFLICT(email) DO UPDATE SET failed_count=excluded.failed_count,locked_until=excluded.locked_until,updated_at=excluded.updated_at").bind(loginKey,failed,lockedUntil,now.toISOString()).run();
  return fail("Incorrect email/mobile number or PIN.",401);
 }
 await DB.prepare("DELETE FROM member_login_attempts WHERE email=?").bind(loginKey).run();
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
