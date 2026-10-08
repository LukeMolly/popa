import { DB, readReceipt } from "../../../../../lib/platform";
const env = { DB };
import { getClubAdmin } from "../../../../admin-auth";
export const dynamic="force-dynamic";
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 const admin=await getClubAdmin();
 if(!admin||!["executive","membership"].includes(admin.role))return new Response("Membership administrator access required.",{status:403});
 try{
  const {id}=await params;
  const row=await env.DB.withContext({adminRole:admin.role},db=>db.prepare("SELECT receipt_key AS receiptKey,receipt_type AS receiptType,receipt_name AS receiptName FROM payments WHERE id=?").bind(id).first<{receiptKey:string;receiptType:string;receiptName:string}>());
  if(!row?.receiptKey)return new Response("Receipt not found.",{status:404});
  const object=await readReceipt(row.receiptKey);
  if(!object.ok||!object.body)return new Response("Receipt not found.",{status:404});
  return new Response(object.body,{headers:{"Content-Type":row.receiptType||object.headers.get("Content-Type")||"application/octet-stream","Content-Disposition":"inline; filename=\"proof\"","Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
 }catch(e){console.error("Receipt retrieval failed",e);return new Response("Receipt is unavailable. Please try again.",{status:502})}
}
