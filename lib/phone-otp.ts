import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { DB } from "./platform";

const DAILY_LIMIT=3;
const OTP_TTL_MINUTES=10;

export function normalizeBotswanaPhone(input:string){
 const digits=input.replace(/\D/g,"");
 if(/^267\d{8}$/.test(digits))return "+"+digits;
 if(/^\d{8}$/.test(digits))return "+267"+digits;
 return null;
}
const hash=(value:string)=>createHash("sha256").update(value).digest("hex");

export async function sendPhoneOtp(rawPhone:string){
 const phone=normalizeBotswanaPhone(rawPhone);
 if(!phone)return {ok:false as const,error:"Enter a valid Botswana mobile number: +267 followed by 8 digits."};
 const since=new Date();since.setUTCHours(0,0,0,0);
 const row=await DB.prepare("SELECT COUNT(*) AS count FROM phone_otp_codes WHERE phone=? AND created_at>=?").bind(phone,since.toISOString()).first<{count:number|string}>();
 if(Number(row?.count||0)>=DAILY_LIMIT)return {ok:false as const,error:"Daily OTP limit reached. A maximum of 3 codes can be sent to this number per day."};
 const code=String(randomInt(0,10000)).padStart(4,"0");
 const now=new Date(),expires=new Date(now.getTime()+OTP_TTL_MINUTES*60*1000);
 await DB.prepare("INSERT INTO phone_otp_codes (id,phone,code_hash,expires_at,used_at,created_at) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(),phone,hash(code),expires.toISOString(),"",now.toISOString()).run();

 const apiKey=process.env.TEXTBEE_API_KEY,deviceId=process.env.TEXTBEE_DEVICE_ID;
 if(!apiKey||!deviceId)return {ok:false as const,error:"SMS gateway is not configured."};
 const base=(process.env.TEXTBEE_API_URL||"https://api.textbee.dev/api/v1").replace(/\/$/,"");
 const response=await fetch(base+"/gateway/devices/"+encodeURIComponent(deviceId)+"/send-sms",{
  method:"POST",headers:{"Content-Type":"application/json","x-api-key":apiKey},
  body:JSON.stringify({recipients:[phone],message:"Your Township Rollers verification code is "+code+". It expires in 10 minutes."})
 });
 if(!response.ok){console.error("TextBee SMS failed",response.status,await response.text());return {ok:false as const,error:"Verification SMS could not be sent. Please try again."};}
 return {ok:true as const,phone,expiresAt:expires.toISOString(),remainingToday:DAILY_LIMIT-Number(row?.count||0)-1};
}

export async function verifyPhoneOtp(rawPhone:string,code:string){
 const phone=normalizeBotswanaPhone(rawPhone);
 if(!phone||!/^\d{4}$/.test(code))return {ok:false as const,error:"Enter a valid phone number and 4-digit code."};
 const row=await DB.prepare("SELECT id,code_hash AS codeHash,expires_at AS expiresAt FROM phone_otp_codes WHERE phone=? AND used_at='' ORDER BY created_at DESC LIMIT 1").bind(phone).first<{id:string;codeHash:string;expiresAt:string}>();
 if(!row||new Date(row.expiresAt)<=new Date())return {ok:false as const,error:"This code is invalid or has expired."};
 const a=Buffer.from(hash(code)),b=Buffer.from(row.codeHash);
 if(a.length!==b.length||!timingSafeEqual(a,b))return {ok:false as const,error:"This code is invalid or has expired."};
 const verifiedAt=new Date().toISOString();
 await DB.prepare("UPDATE phone_otp_codes SET used_at=? WHERE id=?").bind(verifiedAt,row.id).run();
 return {ok:true as const,phone,verifiedAt};
}
