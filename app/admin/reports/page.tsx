import { redirect } from "next/navigation";
import { DB } from "../../../lib/platform";
import { getClubAdmin } from "../../admin-auth";
import { expireDueMemberships, getMembershipSettings } from "../../../lib/membership";
import PrintReportButton from "./print-report-button";

export const dynamic="force-dynamic";

function age(dob:string){
 if(!dob)return null;
 const d=new Date(dob+"T00:00:00"),n=new Date();if(Number.isNaN(d.getTime()))return null;
 let a=n.getFullYear()-d.getFullYear(),m=n.getMonth()-d.getMonth();if(m<0||(m===0&&n.getDate()<d.getDate()))a--;return a;
}
function band(a:number|null){if(a===null)return"Unspecified";if(a<18)return"Under 18";if(a<=24)return"18-24";if(a<=34)return"25-34";if(a<=44)return"35-44";if(a<=54)return"45-54";return"55+"}

export default async function ReportsPage(){
 const admin=await getClubAdmin();
 if(!admin)redirect("/admin-login?return_to=/admin/reports");
 if(!["executive","membership"].includes(admin.role))redirect("/admin");
 await expireDueMemberships();
 const [members,payments,audits,settings]=await Promise.all([
  DB.prepare("SELECT id,status,date_of_birth AS dateOfBirth,membership_location AS membershipLocation,gender,created_at AS createdAt FROM members ORDER BY created_at DESC").all() as Promise<{results:any[]}>,
  DB.prepare("SELECT amount,status,created_at AS createdAt FROM payments ORDER BY created_at DESC").all() as Promise<{results:any[]}>,
  DB.prepare("SELECT actor_name AS actorName,actor_role AS actorRole,action,entity_id AS entityId,created_at AS createdAt FROM audit_logs ORDER BY created_at DESC LIMIT 20").all() as Promise<{results:any[]}>,
  getMembershipSettings()
 ]);
 const count=(s:string)=>members.results.filter(m=>m.status===s).length;
 const revenue=payments.results.filter(p=>p.status==="approved").reduce((sum,p)=>sum+Number(p.amount||0),0);
 const regions=new Map<string,number>(),ages=new Map<string,number>(),genders=new Map<string,number>();
 for(const m of members.results){
  const r=m.membershipLocation||"Unspecified",g=m.gender||"Unspecified",b=band(age(m.dateOfBirth));
  regions.set(r,(regions.get(r)||0)+1);genders.set(g,(genders.get(g)||0)+1);ages.set(b,(ages.get(b)||0)+1);
 }
 return <main className="office-page report-page">
  <div className="office-top no-print"><a href="/admin">← Membership dashboard</a><PrintReportButton/></div>
  <div className="member-heading"><div><p className="eyebrow">TOWNSHIP ROLLERS FC</p><h1>Membership management report</h1><p>{settings.seasonName} · Generated {new Date().toLocaleString("en-BW")}</p></div></div>
  <div className="stats">
   <div><small>TOTAL MEMBERS</small><strong>{members.results.length}</strong></div>
   <div><small>ACTIVE</small><strong>{count("active")}</strong></div>
   <div><small>APPROVED REVENUE</small><strong>P{revenue.toLocaleString("en-BW")}</strong></div>
  </div>
  <div className="stats">
   <div><small>PENDING</small><strong>{count("pending")}</strong></div>
   <div><small>SUSPENDED</small><strong>{count("suspended")}</strong></div>
   <div><small>EXPIRED</small><strong>{count("expired")}</strong></div>
  </div>
  <div className="two-col">
   <section className="member-panel"><h2>Members by region</h2><table><thead><tr><th>Region</th><th>Total</th></tr></thead><tbody>{Array.from(regions).sort((a,b)=>b[1]-a[1]).map(([k,v])=><tr key={k}><td>{k}</td><td>{v}</td></tr>)}</tbody></table></section>
   <section className="member-panel"><h2>Members by age band</h2><table><thead><tr><th>Age band</th><th>Total</th></tr></thead><tbody>{Array.from(ages).map(([k,v])=><tr key={k}><td>{k}</td><td>{v}</td></tr>)}</tbody></table></section>
  </div>
  <div className="two-col">
   <section className="member-panel"><h2>Gender distribution</h2><table><thead><tr><th>Gender</th><th>Total</th></tr></thead><tbody>{Array.from(genders).map(([k,v])=><tr key={k}><td>{k}</td><td>{v}</td></tr>)}</tbody></table></section>
   <section className="member-panel"><h2>Payment status</h2><dl className="details"><div><dt>Submitted</dt><dd>{payments.results.filter(p=>p.status==="submitted").length}</dd></div><div><dt>Approved</dt><dd>{payments.results.filter(p=>p.status==="approved").length}</dd></div><div><dt>Rejected</dt><dd>{payments.results.filter(p=>p.status==="rejected").length}</dd></div><div><dt>Membership fee</dt><dd>P{settings.membershipFee}</dd></div></dl></section>
  </div>
  <section className="member-panel"><h2>Recent audit activity</h2><div className="table-wrap"><table><thead><tr><th>Date</th><th>Administrator</th><th>Action</th><th>Record</th></tr></thead><tbody>{audits.results.map((a,i)=><tr key={i}><td>{new Date(a.createdAt).toLocaleString("en-BW")}</td><td>{a.actorName||a.actorRole||"System"}</td><td>{String(a.action).replaceAll("_"," ")}</td><td>{a.entityId}</td></tr>)}</tbody></table></div></section>
  <style>{"@media print{.no-print{display:none!important}.report-page{max-width:none;padding:0}.member-panel{break-inside:avoid;box-shadow:none}.stats{break-inside:avoid}body{background:#fff}}"}</style>
 </main>;
}
