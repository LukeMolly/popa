import { DB, readReceipt } from "../../../../../lib/platform";
const env = { DB };
import { isClubAdmin } from "../../../../admin-auth";
export const dynamic="force-dynamic";
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 if(!(await isClubAdmin(["executive","membership"])))return new Response("Membership administrator access required.",{status:403});
 const {id}=await params;
 const row=await env.DB.prepare("SELECT receipt_key AS receiptKey,receipt_type AS receiptType,receipt_name AS receiptName FROM payments WHERE id=?").bind(id).first() as {receiptKey:string;receiptType:string;receiptName:string}|null;
 if(!row)return new Response("Receipt not found.",{status:404});
 const object=await readReceipt(row.receiptKey);
 if(!object.ok||!object.body)return new Response("Receipt not found.",{status:404});
 return new Response(object.body,{headers:{"Content-Type":row.receiptType,"Content-Disposition":"inline; filename=\"proof\"","Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
}
