import { DB } from "../../../lib/platform";
const env = { DB };
import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE, hashAdminPin, hashAdminSecret } from "../../admin-auth";
export const dynamic="force-dynamic";
const clean=(v:unknown,n=160)=>typeof v==="string"?v.trim().slice(0,n):"";
const fail=(message:string,status=400)=>Response.json({error:message},{status});
export async function POST(request:Request){
 try{
  const data=await request.json() as Record<string,unknown>,email=clean(data.email).toLowerCase(),pin=clean(data.pin,6),now=new Date();
  if(!/^\S+@\S+\.\S+$/.test(email)||!/^\d{6}$/.test(pin))return fail("Enter your authorised email and six-digit PIN.");
  const attempt=await env.DB.prepare("SELECT failed_count AS failedCount,locked_until AS lockedUntil FROM admin_login_attempts WHERE email=?").bind(email).first() as {failedCount:number;lockedUntil:string}|null;
  if(attempt?.lockedUntil&&attempt.lockedUntil>now.toISOString())return fail("Too many incorrect attempts. Try again in 15 minutes.",429);
  const admin=await env.DB.prepare("SELECT email,pin_salt AS pinSalt,pin_hash AS pinHash FROM admin_users WHERE email=? AND active=1").bind(email).first() as {email:string;pinSalt:string;pinHash:string}|null;
  const supplied=admin?await hashAdminPin(pin,admin.pinSalt):"";
  if(!admin||!admin.pinHash||supplied!==admin.pinHash){
   const failed=(attempt?.failedCount||0)+1,lockedUntil=failed>=5?new Date(now.getTime()+15*60*1000).toISOString():"";
   await env.DB.prepare("INSERT INTO admin_login_attempts (email,failed_count,locked_until,updated_at) VALUES (?,?,?,?) ON CONFLICT(email) DO UPDATE SET failed_count=excluded.failed_count,locked_until=excluded.locked_until,updated_at=excluded.updated_at").bind(email,failed,lockedUntil,now.toISOString()).run();
   return fail(failed>=5?"Too many incorrect attempts. Try again in 15 minutes.":"Email or PIN is incorrect.",401);
  }
  const bytes=crypto.getRandomValues(new Uint8Array(32)),token=btoa(String.fromCharCode(...bytes)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,""),tokenHash=await hashAdminSecret(token),expiresAt=new Date(now.getTime()+12*60*60*1000);
  await env.DB.batch([env.DB.prepare("DELETE FROM admin_login_attempts WHERE email=?").bind(email),env.DB.prepare("DELETE FROM admin_sessions WHERE email=? OR expires_at<=?").bind(email,now.toISOString()),env.DB.prepare("INSERT INTO admin_sessions (token_hash,email,expires_at,created_at) VALUES (?,?,?,?)").bind(tokenHash,email,expiresAt.toISOString(),now.toISOString())]);
  (await cookies()).set(ADMIN_SESSION_COOKIE,token,{httpOnly:true,secure:true,sameSite:"lax",path:"/",expires:expiresAt});
  return Response.json({ok:true});
 }catch(error){console.error(error);const message=error instanceof Error?error.message:"";if(message.includes("DATABASE_URL is not configured"))return fail("Membership database is not connected to this deployment. Ask the system administrator to enable the Preview database environment.",503);return fail("PIN sign-in is temporarily unavailable.",500)}
}
export async function DELETE(){
 try{
  const jar=await cookies(),token=jar.get(ADMIN_SESSION_COOKIE)?.value;
  if(token)await env.DB.prepare("DELETE FROM admin_sessions WHERE token_hash=?").bind(await hashAdminSecret(token)).run();
  jar.set(ADMIN_SESSION_COOKIE,"",{httpOnly:true,secure:true,sameSite:"lax",path:"/",maxAge:0});
  return Response.json({ok:true});
 }catch(error){console.error(error);return fail("Could not sign out.",500)}
}
