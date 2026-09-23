import { sendPhoneOtp } from "../../../../lib/phone-otp";
export const dynamic="force-dynamic";
export async function POST(request:Request){
 try{
  const {phone}=await request.json() as {phone?:string};
  const result=await sendPhoneOtp(String(phone||""));
  return Response.json(result,{status:result.ok?200:400});
 }catch(error){console.error("Phone OTP send failed",error);return Response.json({error:"Could not send verification code."},{status:500});}
}
