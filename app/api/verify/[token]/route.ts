import { DB } from "../../../../lib/platform";
const env = { DB };
export const dynamic = "force-dynamic";
export async function GET(_request:Request,{params}:{params:Promise<{token:string}>}) {
  try {
    const {token}=await params;
    const row=await env.DB.prepare("SELECT id,first_name AS firstName,last_name AS lastName,status,expires_at AS expiresAt FROM members WHERE token=?").bind(token).first() as {id:string;firstName:string;lastName:string;status:string;expiresAt:string}|null;
    if(!row) return Response.json({valid:false},{status:404});
    const status=row.status==="active"&&row.expiresAt&&row.expiresAt<new Date().toISOString().slice(0,10)?"expired":row.status;
    return Response.json({valid:status==="active",id:row.id,name:row.firstName+" "+row.lastName,status,expiresAt:row.expiresAt},{headers:{"Cache-Control":"no-store"}});
  } catch(e) {console.error(e);return Response.json({error:"Verification unavailable"},{status:500})}
}
