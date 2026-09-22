import { DB } from "../../../lib/platform";
const env = { DB };
import { isClubAdmin } from "../../admin-auth";

export const dynamic = "force-dynamic";
const clean=(x:unknown,n=200)=>typeof x==="string"?x.trim().slice(0,n):"";
const fail=(message:string,status=400)=>Response.json({error:message},{status});

export async function POST(request:Request){
 if(!(await isClubAdmin(["executive","membership"])))return fail("Membership administrator access required.",403);
 try{
  const data=await request.json() as Record<string,unknown>,db=env.DB,now=new Date().toISOString();
  if(data.action==="member"){
   const first=clean(data.firstName,80),last=clean(data.lastName,80);
   if(!first||!last)return fail("First and last names are required.");
   const email=clean(data.email,160).toLowerCase(),id="TRFC-"+crypto.randomUUID().slice(0,8).toUpperCase(),token=crypto.randomUUID();
   await db.prepare("INSERT INTO members (id,first_name,last_name,phone,email,status,expires_at,token,created_at) VALUES (?,?,?,?,?,'pending',?,?,?)")
    .bind(id,first,last,clean(data.phone,30),email,clean(data.expiresAt,10),token,now).run();
   return Response.json({id});
  }
  if(data.action==="status"){
   const id=clean(data.id,30),status=clean(data.status,20);
   if(!["active","pending","expired","suspended"].includes(status))return fail("Invalid status.");
   const result=await db.prepare("UPDATE members SET status=? WHERE id=?").bind(status,id).run();
   return result.meta.changes?Response.json({ok:true}):fail("Member not found.",404);
  }
  if(data.action==="expiry"){
   const id=clean(data.id,30),expiresAt=clean(data.expiresAt,10);
   if(!id||!/^\\d{4}-\\d{2}-\\d{2}$/.test(expiresAt)||Number.isNaN(Date.parse(expiresAt+"T00:00:00Z")))return fail("Choose a valid expiry date.");
   const result=await db.prepare("UPDATE members SET expires_at=? WHERE id=?").bind(expiresAt,id).run();
   return result.meta.changes?Response.json({ok:true}):fail("Member not found.",404);
  }
  return fail("Unknown action.");
 }catch(e){
  console.error(e);
  if(String(e).toLowerCase().includes("unique"))return fail("That email or identity is already registered.",409);
  return fail("Could not save. Please try again.",500);
 }
}
