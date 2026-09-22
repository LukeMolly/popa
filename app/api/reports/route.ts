import { DB } from "../../../lib/platform";
import { getClubAdmin } from "../../admin-auth";
import { expireDueMemberships, getMembershipSettings } from "../../../lib/membership";

export const dynamic="force-dynamic";
const csv=(value:unknown)=>{
 const s=String(value??"");
 return '"'+s.replace(/"/g,'""')+'"';
};
const file=(name:string,rows:unknown[][])=>new Response(rows.map(row=>row.map(csv).join(",")).join("\n"),{
 headers:{
  "Content-Type":"text/csv; charset=utf-8",
  "Content-Disposition":"attachment; filename=\""+name+"\"",
  "Cache-Control":"no-store"
 }
});
const age=(dob:string)=>{
 if(!dob)return "";
 const d=new Date(dob+"T00:00:00"),n=new Date();
 if(Number.isNaN(d.getTime()))return "";
 let a=n.getFullYear()-d.getFullYear(),m=n.getMonth()-d.getMonth();
 if(m<0||(m===0&&n.getDate()<d.getDate()))a--;
 return a;
};
const ageBand=(a:number|string)=>{
 if(a==="")return "Unspecified";
 const n=Number(a);
 if(n<18)return "Under 18";
 if(n<=24)return "18-24";
 if(n<=34)return "25-34";
 if(n<=44)return "35-44";
 if(n<=54)return "45-54";
 return "55+";
};

export async function GET(request:Request){
 const admin=await getClubAdmin();
 if(!admin||!["executive","membership"].includes(admin.role))return Response.json({error:"Membership administrator access required."},{status:403});
 try{
  await expireDueMemberships();
  const type=new URL(request.url).searchParams.get("type")||"members";

  if(type==="members"){
   const result=await DB.prepare("SELECT m.id,m.first_name AS firstName,m.last_name AS lastName,m.email,m.phone,m.status,m.date_of_birth AS dateOfBirth,m.membership_location AS membershipLocation,m.gender,m.expires_at AS expiresAt,m.created_at AS createdAt,(SELECT p.status FROM payments p WHERE p.member_id=m.id ORDER BY p.created_at DESC LIMIT 1) AS paymentStatus,(SELECT p.amount FROM payments p WHERE p.member_id=m.id ORDER BY p.created_at DESC LIMIT 1) AS paymentAmount FROM members m ORDER BY m.created_at DESC").all() as {results:any[]};
   return file("township-rollers-members-report.csv",[
    ["Member ID","First Name","Last Name","Email","Phone","Status","Date of Birth","Age","Age Band","Region","Gender","Expiry","Latest Payment Status","Latest Payment Amount","Registered"],
    ...result.results.map(m=>[m.id,m.firstName,m.lastName,m.email,m.phone,m.status,m.dateOfBirth,age(m.dateOfBirth),ageBand(age(m.dateOfBirth)),m.membershipLocation,m.gender,m.expiresAt,m.paymentStatus,m.paymentAmount,m.createdAt])
   ]);
  }

  if(type==="payments"){
   const result=await DB.prepare("SELECT p.id,m.id AS memberId,m.first_name AS firstName,m.last_name AS lastName,m.membership_location AS membershipLocation,p.amount,p.reference,p.payment_method AS paymentMethod,p.payment_method_detail AS paymentMethodDetail,p.status,p.note,p.created_at AS createdAt,p.reviewed_at AS reviewedAt,p.reviewed_by AS reviewedBy FROM payments p JOIN members m ON m.id=p.member_id ORDER BY p.created_at DESC").all() as {results:any[]};
   return file("township-rollers-payments-report.csv",[
    ["Payment ID","Member ID","Member","Region","Amount","Payment Method","Payment Method Detail","Reference","Status","Note","Submitted","Reviewed","Reviewed By"],
    ...result.results.map(p=>[p.id,p.memberId,p.firstName+" "+p.lastName,p.membershipLocation,p.amount,p.paymentMethod,p.paymentMethodDetail,p.reference,p.status,p.note,p.createdAt,p.reviewedAt,p.reviewedBy])
   ]);
  }

  if(type==="audit"){
   const result=await DB.prepare("SELECT id,actor_email AS actorEmail,actor_name AS actorName,actor_role AS actorRole,action,entity_type AS entityType,entity_id AS entityId,note,created_at AS createdAt FROM audit_logs ORDER BY created_at DESC").all() as {results:any[]};
   return file("township-rollers-audit-report.csv",[
    ["Date","Actor","Actor Email","Role","Action","Entity Type","Entity ID","Note"],
    ...result.results.map(a=>[a.createdAt,a.actorName,a.actorEmail,a.actorRole,a.action,a.entityType,a.entityId,a.note])
   ]);
  }

  if(type==="summary"){
   const [members,payments,settings]=await Promise.all([
    DB.prepare("SELECT id,status,date_of_birth AS dateOfBirth,membership_location AS membershipLocation,gender,created_at AS createdAt FROM members").all() as Promise<{results:any[]}>,
    DB.prepare("SELECT amount,status,payment_method AS paymentMethod,created_at AS createdAt FROM payments").all() as Promise<{results:any[]}>,
    getMembershipSettings()
   ]);
   const rows:unknown[][]=[["Section","Metric","Value"]];
   const statusNames=["active","pending","suspended","expired"];
   rows.push(["Overview","Season",settings.seasonName],["Overview","Membership fee",settings.membershipFee],["Overview","Total members",members.results.length]);
   for(const s of statusNames)rows.push(["Status",s,members.results.filter(m=>m.status===s).length]);
   rows.push(["Payments","Approved revenue",payments.results.filter(p=>p.status==="approved").reduce((sum,p)=>sum+Number(p.amount||0),0)]);
   for(const s of ["submitted","approved","rejected"])rows.push(["Payments",s,payments.results.filter(p=>p.status===s).length]);
   for(const method of ["fnb","stanbic","other"])rows.push(["Payment Method",method,payments.results.filter(p=>(p.paymentMethod||"other")===method).length]);

   const regions=new Map<string,number>(),genders=new Map<string,number>(),ages=new Map<string,number>();
   for(const m of members.results){
    const region=m.membershipLocation||"Unspecified",gender=m.gender||"Unspecified",band=ageBand(age(m.dateOfBirth));
    regions.set(region,(regions.get(region)||0)+1);genders.set(gender,(genders.get(gender)||0)+1);ages.set(band,(ages.get(band)||0)+1);
   }
   for(const [k,v] of regions)rows.push(["Region",k,v]);
   for(const [k,v] of genders)rows.push(["Gender",k,v]);
   for(const [k,v] of ages)rows.push(["Age Band",k,v]);
   return file("township-rollers-management-summary.csv",rows);
  }

  return Response.json({error:"Unknown report type."},{status:400});
 }catch(error){
  console.error("Report export failed",error);
  return Response.json({error:"Report could not be generated."},{status:500});
 }
}
