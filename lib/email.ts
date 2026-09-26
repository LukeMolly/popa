import { DB } from "./platform";

type SendEmailInput={
 to:string|string[];
 subject:string;
 html:string;
 text?:string;
 template:string;
};

function recipients(value:string|string[]){
 return (Array.isArray(value)?value:[value]).map(v=>v.trim().toLowerCase()).filter(Boolean);
}
function fromAddress(){ return process.env.EMAIL_FROM?.trim()||""; }
function resendKey(){return process.env.RESEND_API_KEY?.trim()||"";}

export function appBaseUrl(){
 const explicit=process.env.NEXT_PUBLIC_APP_URL?.trim()||process.env.APP_URL?.trim();
 if(explicit)return explicit.replace(/\/+$/,"");
 const vercel=process.env.VERCEL_URL?.trim();
 return vercel?"https://"+vercel.replace(/\/+$/,""):"http://localhost:3000";
}

async function logEmail(to:string,template:string,subject:string,status:string,providerMessageId="",error=""){
 try{
  await DB.prepare("INSERT INTO email_delivery_log (id,recipient,template,subject,provider_message_id,status,error,created_at) VALUES (?,?,?,?,?,?,?,?)")
   .bind(crypto.randomUUID(),to,template,subject,providerMessageId,status,error.slice(0,500),new Date().toISOString()).run();
 }catch(logError){console.error("Email delivery log failed",logError)}
}

export async function sendEmail(input:SendEmailInput){
 const to=recipients(input.to);
 if(!to.length)return {ok:false,skipped:true,error:"No recipients"};
 const apiKey=resendKey(),from=fromAddress();
 if(!apiKey||!from){
  const reason=!apiKey?"RESEND_API_KEY is not configured":"EMAIL_FROM is not configured";
  for(const address of to)await logEmail(address,input.template,input.subject,"skipped","",reason);
  console.warn("Email skipped because mail configuration is incomplete",input.template,to,reason);
  return {ok:false,skipped:true,error:reason};
 }
 try{
  const response=await fetch("https://api.resend.com/emails",{
   method:"POST",
   headers:{"Authorization":"Bearer "+apiKey,"Content-Type":"application/json"},
   body:JSON.stringify({from,to,subject:input.subject,html:input.html,text:input.text})
  });
  const data=await response.json().catch(()=>({})) as {id?:string;message?:string;error?:{message?:string}};
  if(!response.ok){
   const message=data.error?.message||data.message||("Email provider returned "+response.status);
   for(const address of to)await logEmail(address,input.template,input.subject,"failed","",message);
   console.error("Email delivery failed",input.template,message);
   return {ok:false,error:message};
  }
  for(const address of to)await logEmail(address,input.template,input.subject,"sent",data.id||"","");
  return {ok:true,id:data.id||""};
 }catch(error){
  const message=error instanceof Error?error.message:String(error);
  for(const address of to)await logEmail(address,input.template,input.subject,"failed","",message);
  console.error("Email delivery failed",input.template,error);
  return {ok:false,error:message};
 }
}

export async function getMembershipAdminEmails(){
 try{
  const rows=await DB.prepare("SELECT email FROM admin_users WHERE active=1 AND role IN ('executive','membership') ORDER BY email").all<{email:string}>();
  const extra=(process.env.ADMIN_NOTIFICATION_EMAILS||"").split(",").map(v=>v.trim().toLowerCase()).filter(Boolean);
  return Array.from(new Set([...rows.results.map(r=>r.email.toLowerCase()),...extra]));
 }catch(error){
  console.error("Could not load administrator email recipients",error);
  return (process.env.ADMIN_NOTIFICATION_EMAILS||"").split(",").map(v=>v.trim().toLowerCase()).filter(Boolean);
 }
}

export function emailShell(title:string,body:string){
 return '<div style="font-family:Arial,sans-serif;background:#f5f7fb;padding:28px;color:#17233c"><div style="max-width:640px;margin:auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e7ebf2"><div style="background:#102b5a;color:#fff;padding:22px 28px"><div style="font-size:12px;letter-spacing:1.5px;color:#ffd15a;font-weight:700">TOWNSHIP ROLLERS FC</div><h1 style="font-size:24px;margin:8px 0 0">'+title+'</h1></div><div style="padding:28px;line-height:1.6">'+body+'</div><div style="padding:18px 28px;background:#f8fafc;color:#667085;font-size:12px">Township Rollers FC Membership Management System</div></div></div>';
}

export function button(href:string,label:string){
 return '<p style="margin:26px 0"><a href="'+href+'" style="display:inline-block;background:#f6b519;color:#102b5a;text-decoration:none;font-weight:700;padding:13px 20px;border-radius:8px">'+label+'</a></p>';
}
