import { verifyPhoneOtp } from "../../../../lib/phone-otp";
import { DB } from "../../../../lib/platform";
export const dynamic="force-dynamic";
export async function POST(request:Request){
 try{
  const {phone,code}=await request.json() as {phone?:string;code?:string};
  const result=await verifyPhoneOtp(String(phone||""),String(code||""));
  if(!result.ok)return Response.json(result,{status:400});
  await DB.prepare("UPDATE members SET phone_verified_at=? WHERE phone=?").bind(result.verifiedAt,result.phone).run();
  return Response.json({ok:true,phone:result.phone});
 }catch(error){console.error("Phone OTP verification failed",error);return Response.json({error:"Could not verify phone number."},{status:500});}
}
