"use client";
import {useCallback,useEffect,useState} from "react";
import Link from "next/link";

type Payment={
 id:string;memberId:string;firstName:string;lastName:string;amount:number;reference:string;receiptName:string;status:string;note:string;createdAt:string;reviewedAt:string;
};
type Settings={membershipValidityDays:number;expiryReminderDays:number};
type OfficeData={payments:Payment[];settings:Settings};
type AdminRole="executive"|"membership";

export default function Office({role,name}:{role:AdminRole;name:string}){
 const [data,setData]=useState<OfficeData>({payments:[],settings:{membershipValidityDays:334,expiryReminderDays:7}}),[error,setError]=useState(""),[notice,setNotice]=useState(""),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false);

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
   <h2>Proof of payment · P200 per member</h2>
   <div className="table-wrap"><table><thead><tr><th>Member</th><th>Submitted</th><th>Reference</th><th>Proof</th><th>Status</th><th>Decision</th></tr></thead><tbody>
    {data.payments.map(p=><tr key={p.id}>
     <td><b>{p.firstName} {p.lastName}</b><br/><small>{p.memberId}</small></td>
     <td>{new Date(p.createdAt).toLocaleString("en-BW")}</td>
     <td>{p.reference||"—"}</td>
     <td><a href={"/api/staff/receipt/"+encodeURIComponent(p.id)} target="_blank" rel="noopener noreferrer">View {p.receiptName}</a></td>
     <td><span className={"badge "+p.status}>{p.status}</span>{p.note&&<small className="office-note">{p.note}</small>}</td>
     <td>{p.status==="submitted"?<div className="office-actions">
      <button disabled={busy} className="primary" onClick={()=>void save({action:"review",id:p.id,status:"approved"})}>Approve</button>
      <button disabled={busy} className="secondary" onClick={()=>{const note=window.prompt("Reason for rejection (optional)");if(note!==null)void save({action:"review",id:p.id,status:"rejected",note})}}>Reject</button>
     </div>:<span className="muted">{p.reviewedAt?"Reviewed "+new Date(p.reviewedAt).toLocaleDateString("en-BW"):"Completed"}</span>}</td>
    </tr>)}
   </tbody></table>{!data.payments.length&&<p className="muted">No payment submissions yet.</p>}</div>
  </section>

  <section className="member-panel">
   <h2>Membership expiry settings</h2>
   <form className="office-form" onSubmit={async e=>{e.preventDefault();const f=new FormData(e.currentTarget);void save({action:"expiry-settings",membershipValidityDays:Number(f.get("membershipValidityDays")),expiryReminderDays:Number(f.get("expiryReminderDays"))})}}>
    <label>Membership validity (days)<input name="membershipValidityDays" type="number" min="1" max="3650" defaultValue={data.settings.membershipValidityDays} required/></label>
    <label>Expiry reminder (days before)<input name="expiryReminderDays" type="number" min="0" max="3650" defaultValue={data.settings.expiryReminderDays} required/></label>
    <button disabled={busy} className="primary">Save settings</button>
   </form>
   <p className="muted">These settings control the membership expiry reminder displayed to members.</p>
  </section>
 </main>
}
