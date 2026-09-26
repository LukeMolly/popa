"use client";
import {useCallback,useEffect,useState} from "react";
import Link from "next/link";
import { paymentMethodLabel } from "../../lib/payment-methods";

type Payment={
 id:string;memberId:string;firstName:string;lastName:string;amount:number;reference:string;receiptName:string;paymentMethod:string;paymentMethodDetail:string;status:string;note:string;createdAt:string;reviewedAt:string;reviewedBy:string;
};
type Settings={membershipValidityDays:number;expiryReminderDays:number;seasonName:string;seasonStartDate:string;seasonEndDate:string;membershipFee:number;registrationOpen:boolean};
type OfficeData={payments:Payment[];settings:Settings};
type AdminRole="executive"|"membership";
const defaults:Settings={membershipValidityDays:334,expiryReminderDays:7,seasonName:"2026 / 2027",seasonStartDate:"2026-09-01",seasonEndDate:"2027-07-31",membershipFee:200,registrationOpen:true};

export default function Office({role,name}:{role:AdminRole;name:string}){
 const [data,setData]=useState<OfficeData>({payments:[],settings:defaults}),[paymentFilter,setPaymentFilter]=useState("all"),[error,setError]=useState(""),[notice,setNotice]=useState(""),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false);

 const load=useCallback(async()=>{try{const r=await fetch("/api/staff",{cache:"no-store"});const d=await r.json() as OfficeData&{error?:string};if(!r.ok)throw Error(d.error||"Could not load membership office");setData(d);setError("")}catch(e){setError(e instanceof Error?e.message:"Could not load membership office")}finally{setLoading(false)}},[]);
 useEffect(()=>{void load()},[load]);

 async function save(payload:Record<string,unknown>){
  setBusy(true);setError("");setNotice("");
  try{
   const r=await fetch("/api/staff",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
   const d=await r.json() as {error?:string};
   if(!r.ok)throw Error(d.error||"Could not save");
   setNotice("Saved successfully.");await load();return true;
  }catch(e){setError(e instanceof Error?e.message:"Could not save");return false}finally{setBusy(false)}
 }

 const visiblePayments=paymentFilter==="all"?data.payments:data.payments.filter(p=>(p.paymentMethod||"other")===paymentFilter);
 const paymentCounts={all:data.payments.length,fnb:data.payments.filter(p=>p.paymentMethod==="fnb").length,stanbic:data.payments.filter(p=>p.paymentMethod==="stanbic").length,other:data.payments.filter(p=>!p.paymentMethod||p.paymentMethod==="other").length};

 return <main className="office-page">
  <div className="office-top">
   <Link href="/admin">← Membership dashboard</Link>
   {role==="executive"&&<a className="executive-admin-button" href="/admin-access">Manage administrators →</a>}
   <button className="admin-signout" onClick={async()=>{await fetch("/api/admin-pin",{method:"DELETE"});location.assign("/api/auth/signout?callbackUrl=/")}}>Sign out</button>
  </div>

  <div className="member-heading"><div><p className="eyebrow">TOWNSHIP ROLLERS FC</p><h1>Membership office</h1><p>{name} · <strong>{role==="executive"?"Executive Administrator":"Membership Administrator"}</strong></p></div></div>

  {loading&&<p>Loading membership office…</p>}
  {error&&<p role="alert" className="form-error">{error}</p>}
  {notice&&<p role="status" className="form-success">{notice}</p>}

  <section className="member-panel">
   <h2>Proof of payment · P{data.settings.membershipFee} per member</h2>
   <div style={{display:"flex",gap:8,flexWrap:"wrap",margin:"12px 0 18px"}}>
    {[["all","All",paymentCounts.all],["fnb","FNB",paymentCounts.fnb],["stanbic","Stanbic",paymentCounts.stanbic],["other","Other",paymentCounts.other]].map(([value,label,count])=><button key={String(value)} type="button" className={paymentFilter===value?"primary":"secondary"} onClick={()=>setPaymentFilter(String(value))}>{label} ({count})</button>)}
   </div>
   <div className="table-wrap"><table><thead><tr><th>Member</th><th>Submitted</th><th>Payment method</th><th>Reference</th><th>Proof</th><th>Status</th><th>Decision</th></tr></thead><tbody>
    {visiblePayments.map(p=><tr key={p.id}>
     <td><b>{p.firstName} {p.lastName}</b><br/><small>{p.memberId}</small></td>
     <td>{new Date(p.createdAt).toLocaleString("en-BW")}</td>
     <td><b>{paymentMethodLabel(p.paymentMethod,p.paymentMethodDetail)}</b></td>
     <td>{p.reference||"—"}</td>
     <td><a href={"/api/staff/receipt/"+encodeURIComponent(p.id)} target="_blank" rel="noopener noreferrer">View {p.receiptName}</a></td>
     <td><span className={"badge "+p.status}>{p.status}</span>{p.note&&<small className="office-note">{p.note}</small>}</td>
     <td>{p.status==="submitted"?<div className="office-actions">
      <button disabled={busy} className="primary" onClick={()=>void save({action:"review",id:p.id,status:"approved"})}>Approve</button>
      <button disabled={busy} className="secondary" onClick={()=>{const note=window.prompt("Reason for rejection (optional)");if(note!==null)void save({action:"review",id:p.id,status:"rejected",note})}}>Reject</button>
     </div>:<span className="muted">{p.reviewedAt?"Reviewed "+new Date(p.reviewedAt).toLocaleDateString("en-BW")+(p.reviewedBy?" by "+p.reviewedBy:""):"Completed"}</span>}</td>
    </tr>)}
   </tbody></table>{!visiblePayments.length&&<p className="muted">No payment submissions in this payment category.</p>}</div>
  </section>

  <section className="member-panel">
   <h2>Season, fee and expiry settings</h2>
   <form key={JSON.stringify(data.settings)} className="office-form" onSubmit={async e=>{
    e.preventDefault();const f=new FormData(e.currentTarget);
    void save({
     action:"expiry-settings",
     seasonName:f.get("seasonName"),
     seasonStartDate:f.get("seasonStartDate"),
     seasonEndDate:f.get("seasonEndDate"),
     membershipFee:Number(f.get("membershipFee")),
     membershipValidityDays:Number(f.get("membershipValidityDays")),
     expiryReminderDays:Number(f.get("expiryReminderDays")),
     registrationOpen:f.get("registrationOpen")==="on"
    });
   }}>
    <label>Season name<input name="seasonName" defaultValue={data.settings.seasonName} required maxLength={60}/></label>
    <div className="office-numbers">
     <label>Season start<input name="seasonStartDate" type="date" defaultValue={data.settings.seasonStartDate} required/></label>
     <label>Season end<input name="seasonEndDate" type="date" defaultValue={data.settings.seasonEndDate} required/></label>
     <label>Membership fee (P)<input name="membershipFee" type="number" min="0" max="100000" defaultValue={data.settings.membershipFee} required/></label>
     <label>Fallback validity (days)<input name="membershipValidityDays" type="number" min="1" max="3650" defaultValue={data.settings.membershipValidityDays} required/></label>
     <label>Expiry reminder (days)<input name="expiryReminderDays" type="number" min="0" max="3650" defaultValue={data.settings.expiryReminderDays} required/></label>
    </div>
    <label style={{display:"flex",alignItems:"center",gap:10}}><input name="registrationOpen" type="checkbox" defaultChecked={data.settings.registrationOpen}/> Registration open to new members</label>
    <button disabled={busy} className="primary">Save membership settings</button>
   </form>
   <p className="muted">Approved payments activate membership to the configured season end date. After a season has ended, the fallback validity period is used until new season dates are configured.</p>
  </section>
 </main>;
}
