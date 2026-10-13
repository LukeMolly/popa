import { randomInt, randomUUID, createHmac } from "node:crypto";
import { DB } from "../../../lib/platform";
import { newPasswordRecord } from "../../../lib/member-auth";
export const dynamic="force-dynamic";
const generic="If the number is registered, a recovery code will be sent.";
const ok=()=>Response.json({message:generic},{headers:{"Cache-Control":"no-store"}});
const invalid=()=>Response.json({error:"Invalid or expired code. Request a new code if needed."},{status:400});
const normalise=(input:unknown)=>{const digits=String(input||"").replace(/\D/g,"");return /^(?:267)?[0-9]{8}$/.test(digits)?digits.slice(-8):""};
function secret(){const value=process.env.POPA_PIN_RECOVERY_SECRET;if(!value||value.length<32)throw Error("Recovery secret not configured");return value}
function digest(phone:string,code:string){return createHmac("sha256",secret()).update(phone+":"+code).digest("hex")}
export async function POST(req:Request){
 try{
 const body=await req.json().catch(()=>null) as {action?:string;phone?:string;code?:string;pin?:string;confirmPin?:string}|null;
 const phone=normalise(body?.phone);if(!phone)return Response.json({error:"Enter a valid Botswana 8-digit mobile number."},{status:400});
 if(body?.action==="send"){
  // Limit both known and unknown phone numbers to prevent enumeration and SMS abuse.
  const now=new Date(),day=new Date(now.getTime()-86400000).toISOString();
  const prior=await DB.prepare("SELECT created_at AS createdAt FROM member_pin_resets WHERE phone=? AND created_at>? ORDER BY created_at DESC").bind(phone,day).all<{createdAt:string}>();
  if(prior.results.length>=3)return ok();
  if(prior.results[0]&&Date.now()-new Date(prior.results[0].createdAt).getTime()<60000)return ok();
  const list=await DB.prepare("SELECT id FROM members WHERE regexp_replace(phone, '[^0-9]', '', 'g') IN (?,?) LIMIT 2").bind(phone,"267"+phone).all<{id:string}>();
  if(list.results.length!==1)return ok();
  const apiKey=process.env.TEXTBEE_API_KEY;if(!apiKey)return Response.json({error:"SMS recovery is temporarily unavailable."},{status:503});
  const code=String(randomInt(1000,10000)),id=randomUUID();
  await DB.prepare("INSERT INTO member_pin_resets (id,member_id,phone,code_hash,created_at,expires_at,attempts) VALUES (?,?,?,?,?,?,0)").bind(id,list.results[0].id,phone,digest(phone,code),now.toISOString(),new Date(now.getTime()+5*60000).toISOString()).run();
  try{
   const response=await fetch("https://api.textbee.dev/api/v1/gateway/send-sms",{method:"POST",headers:{"x-api-key":apiKey,"content-type":"application/json"},body:JSON.stringify({recipients:["+267"+phone],message:"Township Rollers POPA: your PIN recovery code is "+code+". Expires in 5 minutes. Do not share it.",...(process.env.TEXTBEE_DEVICE_ID?{deviceId:process.env.TEXTBEE_DEVICE_ID}:{})}),signal:AbortSignal.timeout(12000)});
   if(!response.ok)throw Error("SMS gateway unavailable");
  }catch{await DB.prepare("DELETE FROM member_pin_resets WHERE id=?").bind(id).run();return Response.json({error:"Could not send the SMS. Try again later."},{status:503})}
  return ok();
 }
 if(body?.action==="reset"){
  const code=String(body.code||""),pin=String(body.pin||"");
  if(!/^\d{4}$/.test(code))return invalid();
  if(!/^[A-Za-z0-9]{4}$/.test(pin)||pin!==body.confirmPin)return Response.json({error:"Enter and confirm the same four-character PIN."},{status:400});
  const last=await DB.prepare("SELECT id,member_id AS memberId,code_hash AS codeHash,expires_at AS expiresAt,attempts FROM member_pin_resets WHERE phone=? AND used_at IS NULL ORDER BY created_at DESC LIMIT 1").bind(phone).first<{id:string;memberId:string;codeHash:string;expiresAt:string;attempts:number}>();
  if(!last||new Date(last.expiresAt).getTime()<Date.now()||last.attempts>=5)return invalid();
  const record=await DB.prepare("UPDATE member_pin_resets SET attempts=attempts+1 WHERE id=? AND used_at IS NULL AND attempts<5 RETURNING id").bind(last.id).first();
  if(!record)return invalid();
  if(last.codeHash!==digest(phone,code))return invalid();
  const consumed=await DB.prepare("UPDATE member_pin_resets SET used_at=? WHERE id=? AND code_hash=? AND used_at IS NULL AND expires_at>? RETURNING member_id AS memberId").bind(new Date().toISOString(),last.id,digest(phone,code),new Date().toISOString()).first<{memberId:string}>();
  if(!consumed)return invalid();
  const password=await newPasswordRecord(pin);
  await DB.batch([DB.prepare("UPDATE members SET password_salt=?,password_hash=?,password_must_change=FALSE WHERE id=?").bind(password.salt,password.hash,consumed.memberId),DB.prepare("DELETE FROM member_sessions WHERE member_id=?").bind(consumed.memberId)]);
  return Response.json({ok:true,message:"PIN updated. Sign in with your new PIN."},{headers:{"Cache-Control":"no-store"}});
 }
 return Response.json({error:"Invalid request."},{status:400});
 }catch(error){console.error("PIN recovery failed",error instanceof Error?error.message:"Unknown error");return Response.json({error:"PIN recovery is temporarily unavailable."},{status:503})}
}
