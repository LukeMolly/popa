import { DB, deleteReceipt, uploadReceipt } from "../../../../lib/platform";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { isClubAdmin } from "../../../admin-auth";
import { expireDueMemberships, getMembershipSettings } from "../../../../lib/membership";
import { writeAudit } from "../../../../lib/audit";
import { emailAdminsPaymentSubmitted } from "../../../../lib/account-emails";
import { PAYMENT_METHOD_CODES } from "../../../../lib/payment-methods";
const env = { DB };

export const dynamic="force-dynamic";
type Context={params:Promise<{token:string}>};

async function authorisedMember(token:string){
 const user=await getChatGPTUser();
 if(!user)return null;
 const member=await env.DB.prepare("SELECT id,email,first_name AS firstName,last_name AS lastName FROM members WHERE token=?").bind(token).first() as {id:string;email:string;firstName:string;lastName:string}|null;
 if(!member)return null;
 if(member.email.toLowerCase()!==user.email.toLowerCase()&&!(await isClubAdmin(["executive","membership"])))return null;
 return member;
}

export async function GET(_request:Request,{params}:Context){
 try{
  const {token}=await params;
  if(!(await authorisedMember(token)))return Response.json({error:"Member sign-in required."},{status:403});
  await expireDueMemberships();
  const member=await env.DB.prepare("SELECT id,first_name AS firstName,last_name AS lastName,status,expires_at AS expiresAt,token FROM members WHERE token=?").bind(token).first();
  if(!member)return Response.json({error:"Member not found."},{status:404});
  const [payment,settings]=await Promise.all([
   env.DB.prepare("SELECT id,amount,reference,status,note,payment_method AS paymentMethod,payment_method_detail AS paymentMethodDetail,created_at AS createdAt FROM payments WHERE member_id=? ORDER BY created_at DESC LIMIT 1").bind(member.id).first(),
   getMembershipSettings()
  ]);
  return Response.json({member:{...member,reminderDays:settings.expiryReminderDays},payment,settings},{headers:{"Cache-Control":"no-store"}});
 }catch(e){console.error(e);return Response.json({error:"Membership unavailable."},{status:500})}
}

export async function POST(request:Request,{params}:Context){
 try{
  const {token}=await params,authorised=await authorisedMember(token);
  if(!authorised)return Response.json({error:"Member sign-in required."},{status:403});
  await expireDueMemberships();
  const member=await env.DB.prepare("SELECT id,status,expires_at AS expiresAt FROM members WHERE token=?").bind(token).first() as {id:string;status:string;expiresAt:string}|null;
  if(!member)return Response.json({error:"Member not found."},{status:404});
  if(member.status==="active"&&member.expiresAt>=new Date().toISOString().slice(0,10))return Response.json({error:"Membership is already active."},{status:409});
  const latest=await env.DB.prepare("SELECT status FROM payments WHERE member_id=? ORDER BY created_at DESC LIMIT 1").bind(member.id).first() as {status:string}|null;
  if(latest?.status==="submitted")return Response.json({error:"A payment is already awaiting review."},{status:409});

  const settings=await getMembershipSettings();
  const form=await request.formData(),file=form.get("proof"),reference=String(form.get("reference")||"").trim().slice(0,100),paymentMethod=String(form.get("paymentMethod")||"").trim().toLowerCase(),paymentMethodDetail=String(form.get("paymentMethodDetail")||"").trim().slice(0,120);
  if(!PAYMENT_METHOD_CODES.includes(paymentMethod as any))return Response.json({error:"Choose FNB, Stanbic Bank or another payment method."},{status:400});
  if(paymentMethod==="other"&&!paymentMethodDetail)return Response.json({error:"Describe the other payment method used."},{status:400});
  if(!(file instanceof File))return Response.json({error:"Select a proof of payment file."},{status:400});
  if(file.size<1||file.size>5*1024*1024)return Response.json({error:"Use a file under 5 MB."},{status:400});
  const type=file.type.toLowerCase();
  if(!["image/jpeg","image/png","image/webp","application/pdf"].includes(type))return Response.json({error:"Upload a JPG, PNG, WebP or PDF."},{status:400});

  const id=crypto.randomUUID(),key="receipts/"+paymentMethod+"/"+id,receiptUrl=await uploadReceipt(key,await file.arrayBuffer(),type),now=new Date().toISOString();
  try{
   await env.DB.prepare("INSERT INTO payments (id,member_id,amount,receipt_key,receipt_name,receipt_type,reference,status,note,created_at,reviewed_at,reviewed_by,payment_method,payment_method_detail) VALUES (?,?,?,?,?,?,?,'submitted','Renewal payment',?,'','',?,?)")
    .bind(id,member.id,settings.membershipFee,receiptUrl,file.name.slice(0,200),type,reference,now,paymentMethod,paymentMethodDetail).run();
  }catch(e){await deleteReceipt(receiptUrl);throw e}
  await writeAudit({email:authorised.email,name:authorised.firstName+" "+authorised.lastName,role:"member"},"renewal_payment_submitted","payment",id,undefined,{memberId:member.id,amount:settings.membershipFee,status:"submitted",paymentMethod,paymentMethodDetail},"Member renewal submission");
  await emailAdminsPaymentSubmitted({id:authorised.id,email:authorised.email,firstName:authorised.firstName,lastName:authorised.lastName},settings.membershipFee,id);
  return Response.json({id,status:"submitted",amount:settings.membershipFee,paymentMethod,paymentMethodDetail},{status:201});
 }catch(e){console.error(e);return Response.json({error:"Could not submit proof. Please try again."},{status:500})}
}
