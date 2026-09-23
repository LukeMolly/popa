import { sendPhoneOtp } from "../../../../lib/phone-otp";
import { DB } from "../../../../lib/platform";
import { getMemberSession } from "../../../../lib/member-auth";
export const dynamic="force-dynamic";
export async function POST(request:Request){
 try{
  const {phone}=await request.json() as {phone?:string};
  const member=await getMemberSession();
  let target=String(phone||"");
  if(member){
   const contact=await DB.prepare("SELECT phone FROM members WHERE id=?").bind(member.id).first<{phone:string}>();
   if(!contact?.phone)return Response.json({error:"No mobile number is registered on this account."},{status:400});
   target=contact.phone;
  }
  const result=await sendPhoneOtp(target);
  return Response.json(result,{status:result.ok?200:400});
 }catch(error){console.error("Phone OTP send failed",error);return Response.json({error:"Could not send verification code."},{status:500});}
}
