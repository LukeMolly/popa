import { verifyPhoneOtp } from "../../../../lib/phone-otp";
import { DB } from "../../../../lib/platform";
import { getMemberSession } from "../../../../lib/member-auth";
export const dynamic="force-dynamic";
export async function POST(request:Request){
 try{
  const {phone,code}=await request.json() as {phone?:string;code?:string};
  const member=await getMemberSession();
  let target=String(phone||"");
  if(member){
   const contact=await DB.prepare("SELECT phone FROM members WHERE id=?").bind(member.id).first<{phone:string}>();
   if(!contact?.phone)return Response.json({error:"No mobile number is registered on this account."},{status:400});
   target=contact.phone;
  }
  const result=await verifyPhoneOtp(target,String(code||""));
  if(!result.ok)return Response.json(result,{status:400});
  if(member)await DB.prepare("UPDATE members SET phone_verified_at=? WHERE id=? AND phone=?").bind(result.verifiedAt,member.id,result.phone).run();
  return Response.json({ok:true,phone:result.phone});
 }catch(error){console.error("Phone OTP verification failed",error);return Response.json({error:"Could not verify phone number."},{status:500});}
}
