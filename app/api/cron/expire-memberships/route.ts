import { expireDueMemberships } from "../../../../lib/membership";

export const dynamic="force-dynamic";

export async function GET(){
 try{
  const expired=await expireDueMemberships();
  return Response.json({ok:true,expired,checkedAt:new Date().toISOString()},{headers:{"Cache-Control":"no-store"}});
 }catch(error){
  console.error("Automatic membership expiry failed",error);
  return Response.json({ok:false,error:"Automatic expiry check failed."},{status:500});
 }
}
