import { DB, deleteReceipt, uploadReceipt } from "../../../../lib/platform";
const env = { DB };
import { getChatGPTUser } from "../../../chatgpt-auth";
import { isClubAdmin } from "../../../admin-auth";

export const dynamic="force-dynamic";
type Context={params:Promise<{token:string}>};

async function authorisedMember(token:string){
 const user=await getChatGPTUser();
 if(!user)return null;
 const member=await env.DB.prepare("SELECT id,email FROM members WHERE token=?").bind(token).first() as {id:string;email:string}|null;
 if(!member)return null;
 if(member.email.toLowerCase()!==user.email.toLowerCase()&&!(await isClubAdmin(["executive","membership"])))return null;
 return member;
}

export async function GET(_request:Request,{params}:Context){
 try{
  const {token}=await params;
  if(!(await authorisedMember(token)))return Response.json({error:"Member sign-in required."},{status:403});
  const member=await env.DB.prepare("SELECT id,first_name AS firstName,last_name AS lastName,status,expires_at AS expiresAt,token FROM members WHERE token=?").bind(token).first();
  if(!member)return Response.json({error:"Member not found."},{status:404});
  const [payment,settings]=await Promise.all([
   env.DB.prepare("SELECT id,amount,reference,status,note,created_at AS createdAt FROM payments WHERE member_id=? ORDER BY created_at DESC LIMIT 1").bind(member.id).first(),
   env.DB.prepare("SELECT expiry_reminder_days AS reminderDays FROM club_settings WHERE id=1").first() as Promise<{reminderDays:number}|null>
  ]);
  return Response.json({member:{...member,reminderDays:Number(settings?.reminderDays)||7},payment},{headers:{"Cache-Control":"no-store"}});
 }catch(e){console.error(e);return Response.json({error:"Membership unavailable."},{status:500})}
}

export async function POST(request:Request,{params}:Context){
 try{
  const {token}=await params,authorised=await authorisedMember(token);
  if(!authorised)return Response.json({error:"Member sign-in required."},{status:403});
  const member=await env.DB.prepare("SELECT id,status,expires_at AS expiresAt FROM members WHERE token=?").bind(token).first() as {id:string;status:string;expiresAt:string}|null;
  if(!member)return Response.json({error:"Member not found."},{status:404});
  if(member.status==="active"&&member.expiresAt>=new Date().toISOString().slice(0,10))return Response.json({error:"Membership is already active."},{status:409});
  const latest=await env.DB.prepare("SELECT status FROM payments WHERE member_id=? ORDER BY created_at DESC LIMIT 1").bind(member.id).first() as {status:string}|null;
  if(latest?.status==="submitted")return Response.json({error:"A payment is already awaiting review."},{status:409});

  const form=await request.formData(),file=form.get("proof"),reference=String(form.get("reference")||"").trim().slice(0,100);
  if(!(file instanceof File))return Response.json({error:"Select a proof of payment file."},{status:400});
  if(file.size<1||file.size>5*1024*1024)return Response.json({error:"Use a file under 5 MB."},{status:400});
  const type=file.type.toLowerCase();
  if(!["image/jpeg","image/png","image/webp","application/pdf"].includes(type))return Response.json({error:"Upload a JPG, PNG, WebP or PDF."},{status:400});

  const id=crypto.randomUUID(),key="receipts/"+id,receiptUrl=await uploadReceipt(key,await file.arrayBuffer(),type);
  try{
   await env.DB.prepare("INSERT INTO payments (id,member_id,amount,receipt_key,receipt_name,receipt_type,reference,status,note,created_at,reviewed_at) VALUES (?,?,?,?,?,?,?,'submitted','',?,'')")
    .bind(id,member.id,200,receiptUrl,file.name.slice(0,200),type,reference,new Date().toISOString()).run();
  }catch(e){await deleteReceipt(receiptUrl);throw e}
  return Response.json({id,status:"submitted"},{status:201});
 }catch(e){console.error(e);return Response.json({error:"Could not submit proof. Please try again."},{status:500})}
}
