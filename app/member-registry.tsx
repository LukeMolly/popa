"use client";
import {useCallback,useEffect,useMemo,useState} from "react";
import QRCode from "qrcode";
import {ArrowLeft,Copy,Download,KeyRound,Plus,Search,Users} from "lucide-react";

type Member={
 id:string;firstName:string;lastName:string;phone:string;email:string;status:string;expiresAt:string;token:string;createdAt:string;
 idNumber?:string;dateOfBirth?:string;placeOfBirth?:string;membershipLocation?:string;gender?:string;passwordMustChange?:boolean;
};
type Payment={id:string;memberId:string;amount:number;reference:string;status:string;note:string;createdAt:string;reviewedAt:string;reviewedBy?:string};
type Audit={id:string;actorEmail:string;actorName:string;actorRole:string;action:string;entityType:string;entityId:string;note:string;createdAt:string};
type Recovery={id:string;memberId:string;email:string;status:string;requestedAt:string;resolvedAt:string;resolvedBy:string;firstName:string;lastName:string};
type Settings={seasonName:string;seasonStartDate:string;seasonEndDate:string;membershipFee:number;registrationOpen:boolean;membershipValidityDays:number;expiryReminderDays:number};
type Data={members:Member[];payments:Payment[];audits:Audit[];recoveryRequests:Recovery[];settings:Settings};
const defaultSettings:Settings={seasonName:"2026 / 2027",seasonStartDate:"2026-09-01",seasonEndDate:"2027-07-31",membershipFee:200,registrationOpen:true,membershipValidityDays:334,expiryReminderDays:7};
const empty:Data={members:[],payments:[],audits:[],recoveryRequests:[],settings:defaultSettings};

function Badge({status}:{status:string}){return <span className={"badge "+status}>{status}</span>}
function ageFromDob(value?:string){if(!value)return null;const d=new Date(value+"T00:00:00");if(Number.isNaN(d.getTime()))return null;const n=new Date();let age=n.getFullYear()-d.getFullYear();const m=n.getMonth()-d.getMonth();if(m<0||(m===0&&n.getDate()<d.getDate()))age--;return age}
function effectiveStatus(m:Member){return m.status==="active"&&m.expiresAt&&m.expiresAt<new Date().toISOString().slice(0,10)?"expired":m.status}
function csv(value:unknown){const s=String(value??"");return '"'+s.replace(/"/g,'""')+'"'}

export default function MemberRegistry(){
 const [data,setData]=useState<Data>(empty),[loading,setLoading]=useState(true),[error,setError]=useState(""),[notice,setNotice]=useState(""),[query,setQuery]=useState(""),[statusFilter,setStatusFilter]=useState("all"),[regionFilter,setRegionFilter]=useState("all"),[genderFilter,setGenderFilter]=useState("all"),[minAge,setMinAge]=useState(""),[maxAge,setMaxAge]=useState(""),[selected,setSelected]=useState<Member|null>(null),[qr,setQr]=useState(""),[showForm,setShowForm]=useState(false),[busy,setBusy]=useState(false);

 const load=useCallback(async()=>{
  try{
   const r=await fetch("/api/data",{cache:"no-store"}),v=await r.json() as Data&{error?:string};
   if(!r.ok)throw Error(v.error||"Could not load records");
   setData({...empty,...v,settings:v.settings||defaultSettings});setError("");
  }catch(e){setError(e instanceof Error?e.message:"Could not load records")}finally{setLoading(false)}
 },[]);
 useEffect(()=>{void load()},[load]);
 useEffect(()=>{if(!selected)return;QRCode.toDataURL(location.origin+"/verify/"+selected.token,{width:256,margin:2,color:{dark:"#102b5a",light:"#ffffff"}}).then(setQr).catch(()=>setQr(""))},[selected]);

 async function send(payload:Record<string,unknown>,success:string){
  setBusy(true);setError("");setNotice("");
  try{
   const r=await fetch("/api/manage",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
   const v=await r.json() as {error?:string;expiresAt?:string};
   if(!r.ok)throw Error(v.error||"Could not save");
   setNotice(success);await load();return v;
  }catch(e){setError(e instanceof Error?e.message:"Could not save");return null}finally{setBusy(false)}
 }

 async function resetPassword(member:Member){
  if(!window.confirm("Issue a one-time 4-character recovery code for "+member.firstName+" "+member.lastName+"?"))return;
  setBusy(true);setError("");
  try{
   const r=await fetch("/api/manage",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"password-reset",id:member.id})});
   const v=await r.json() as {error?:string;temporaryCode?:string};
   if(!r.ok||!v.temporaryCode)throw Error(v.error||"Could not reset password");
   await load();
   window.alert("Temporary recovery code for "+member.firstName+" "+member.lastName+": "+v.temporaryCode+"\n\nShare this code securely. It is shown only once and the member must change it after signing in.");
  }catch(e){setError(e instanceof Error?e.message:"Could not reset password")}finally{setBusy(false)}
 }

 const latestPaymentByMember=useMemo(()=>{
  const map=new Map<string,Payment>();for(const p of data.payments)if(!map.has(p.memberId))map.set(p.memberId,p);return map;
 },[data.payments]);
 const regions=useMemo(()=>Array.from(new Set(data.members.map(m=>m.membershipLocation||"Unspecified"))).sort(),[data.members]);
 const genders=useMemo(()=>Array.from(new Set(data.members.map(m=>m.gender||"Unspecified"))).sort(),[data.members]);
 const pendingRecoveries=useMemo(()=>data.recoveryRequests.filter(r=>r.status==="pending"),[data.recoveryRequests]);

 const list=useMemo(()=>data.members.filter(m=>{
  const hay=(m.id+" "+m.firstName+" "+m.lastName+" "+m.phone+" "+m.email+" "+(m.membershipLocation||"")).toLowerCase(),age=ageFromDob(m.dateOfBirth);
  if(query&&!hay.includes(query.toLowerCase()))return false;
  if(statusFilter!=="all"&&effectiveStatus(m)!==statusFilter)return false;
  if(regionFilter!=="all"&&(m.membershipLocation||"Unspecified")!==regionFilter)return false;
  if(genderFilter!=="all"&&(m.gender||"Unspecified")!==genderFilter)return false;
  if(minAge&&age!==null&&age<Number(minAge))return false;
  if(maxAge&&age!==null&&age>Number(maxAge))return false;
  if((minAge||maxAge)&&age===null)return false;
  return true;
 }),[data.members,query,statusFilter,regionFilter,genderFilter,minAge,maxAge]);

 const totals=useMemo(()=>{
  const count=(s:string)=>data.members.filter(m=>effectiveStatus(m)===s).length,approved=data.payments.filter(p=>p.status==="approved");
  return {total:data.members.length,active:count("active"),pending:count("pending"),suspended:count("suspended"),expired:count("expired"),revenue:approved.reduce((sum,p)=>sum+Number(p.amount||0),0),pendingPayments:data.payments.filter(p=>p.status==="submitted").length};
 },[data]);
 const regionSummary=useMemo(()=>regions.map(region=>({region,total:data.members.filter(m=>(m.membershipLocation||"Unspecified")===region).length})).sort((a,b)=>b.total-a.total),[regions,data.members]);

 function downloadFilteredCsv(){
  const header=["Member ID","First Name","Last Name","Email","Phone","Status","Date of Birth","Age","Region","Gender","Expiry Date","Latest Payment Status","Latest Payment Amount","Created At"];
  const rows=list.map(m=>{const p=latestPaymentByMember.get(m.id);return [m.id,m.firstName,m.lastName,m.email,m.phone,effectiveStatus(m),m.dateOfBirth||"",ageFromDob(m.dateOfBirth)??"",m.membershipLocation||"",m.gender||"",m.expiresAt||"",p?.status||"",p?.amount||"",m.createdAt]});
  const blob=new Blob([[header,...rows].map(row=>row.map(csv).join(",")).join("\n")],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download="township-rollers-filtered-members.csv";a.click();URL.revokeObjectURL(url);
 }

 const selectedRecovery=selected?pendingRecoveries.find(r=>r.memberId===selected.id):undefined;

 return <div className="app">
  <aside className="rail">
   <div className="identity"><div className="crest">TR</div><div><strong>TOWNSHIP<br/>ROLLERS FC</strong><small>MEMBERSHIP OFFICE</small></div></div>
   <nav aria-label="Sections"><button className="on"><Users size={19}/> Membership</button></nav>
   <div className="rail-foot"><a href="/office" style={{color:"#ffd15a",display:"block",marginBottom:14}}>Payments & season settings →</a><a href="/admin/reports" style={{color:"#ffd15a",display:"block",marginBottom:14}}>Management report →</a><a href="/admin-access" style={{color:"#ffd15a",display:"block",marginBottom:14}}>Administrator access →</a><button className="rail-signout" onClick={async()=>{await fetch("/api/admin-pin",{method:"DELETE"});location.assign("/api/auth/signout?callbackUrl=/")}}>Sign out →</button><span className="tiny-dot"/> Membership administration</div>
  </aside>

  <main className="main">
   <header className="top"><div className="mobile-brand"><div className="crest">TR</div><b>Township Rollers</b></div><span>MEMBERSHIP MANAGEMENT SYSTEM</span><span className="top-season">{data.settings.seasonName}</span></header>
   <div className="content">
   {selected?<>
    <button className="back" onClick={()=>setSelected(null)}><ArrowLeft size={17}/> Back to members</button>
    <div className="page-head"><div><p className="eyebrow">MEMBER RECORD</p><h1>{selected.firstName} {selected.lastName}</h1><p className="sub">{selected.id} · Joined {new Date(selected.createdAt).toLocaleDateString("en-BW")}</p></div><Badge status={effectiveStatus(selected)}/></div>

    {selectedRecovery&&<section className="panel" style={{borderTop:"5px solid #f6b519"}}><div className="panel-head"><div><h2>Password recovery requested</h2><p>Requested {new Date(selectedRecovery.requestedAt).toLocaleString("en-BW")}</p></div><button disabled={busy} className="primary" onClick={()=>void resetPassword(selected)}><KeyRound size={17}/> Issue temporary code</button></div><p className="muted">The generated 4-character code is shown once to the administrator. The member must change it after login.</p></section>}

    <div className="detail-grid">
     <section className="panel">
      <h2>Membership details</h2>
      <dl className="details">
       <div><dt>Member ID</dt><dd>{selected.id}</dd></div><div><dt>Email</dt><dd>{selected.email||"—"}</dd></div><div><dt>Phone</dt><dd>{selected.phone||"—"}</dd></div><div><dt>ID / Passport</dt><dd>{selected.idNumber||"—"}</dd></div><div><dt>Date of birth</dt><dd>{selected.dateOfBirth||"—"}{selected.dateOfBirth?" · "+ageFromDob(selected.dateOfBirth)+" yrs":""}</dd></div><div><dt>Region</dt><dd>{selected.membershipLocation||"—"}</dd></div><div><dt>Gender</dt><dd>{selected.gender||"—"}</dd></div><div><dt>Expiry</dt><dd>{selected.expiresAt||"Not set"}</dd></div>
      </dl>
      <label className="field">Membership status<select value={selected.status} disabled={busy} onChange={async e=>{const status=e.target.value,v=await send({action:"status",id:selected.id,status},"Status updated");if(v)setSelected({...selected,status,expiresAt:v.expiresAt||selected.expiresAt})}}><option value="pending">Pending</option><option value="active">Active</option><option value="expired">Expired</option><option value="suspended">Suspended</option></select></label>
      <form className="expiry-edit" onSubmit={async e=>{e.preventDefault();const expiresAt=String(new FormData(e.currentTarget).get("expiresAt")||""),v=await send({action:"expiry",id:selected.id,expiresAt},"Expiry date updated");if(v)setSelected({...selected,expiresAt})}}><label className="field">Expiry date<input name="expiresAt" type="date" key={selected.expiresAt} defaultValue={selected.expiresAt||""} required/></label><button disabled={busy} className="primary">Save expiry date</button></form>
      <button disabled={busy} className="secondary" onClick={()=>void resetPassword(selected)}><KeyRound size={16}/> Reset member password</button>
     </section>

     <section className="panel qr-panel">
      <h2>Digital membership card</h2>
      <div className="season-pass"><img className="season-art" src="/township-rollers-season-ticket.jpg" alt="Township Rollers membership card"/><div className="pass-content"><span className="pass-label">MEMBERSHIP ACCESS PASS</span><strong className="pass-name">{selected.firstName} {selected.lastName}</strong><span className="pass-id">{selected.id}</span><div className="pass-qr">{qr?<img src={qr} alt="Membership verification QR"/>:<span>QR unavailable</span>}</div><span className={"pass-status "+effectiveStatus(selected)}>{effectiveStatus(selected).toUpperCase()}</span></div></div>
      <p><a href={"/member/"+selected.token} target="_blank" rel="noopener noreferrer">Open member portal →</a></p>
      <button className="secondary" onClick={()=>{navigator.clipboard.writeText(location.origin+"/verify/"+selected.token);setNotice("Verification link copied")}}><Copy size={16}/> Copy verification link</button>
     </section>
    </div>

    <section className="panel"><h2>Payment history</h2><div className="table-wrap"><table><thead><tr><th>Date</th><th>Amount</th><th>Reference</th><th>Status</th><th>Reviewed by</th><th>Note</th></tr></thead><tbody>{data.payments.filter(p=>p.memberId===selected.id).map(p=><tr key={p.id}><td>{new Date(p.createdAt).toLocaleString("en-BW")}</td><td>P{p.amount}</td><td>{p.reference||"—"}</td><td><Badge status={p.status}/></td><td>{p.reviewedBy||"—"}</td><td>{p.note||"—"}</td></tr>)}</tbody></table>{!data.payments.some(p=>p.memberId===selected.id)&&<div className="empty">No payments recorded.</div>}</div></section>
   </>:<>
    <div className="page-head"><div><p className="eyebrow">MEMBERSHIP DASHBOARD</p><h1>Members</h1><p className="sub">{data.settings.seasonName} · Registration {data.settings.registrationOpen?"open":"closed"} · Fee P{data.settings.membershipFee}</p></div><div style={{display:"flex",gap:10,flexWrap:"wrap"}}><button className="secondary" onClick={downloadFilteredCsv}><Download size={18}/> Filtered CSV</button><a className="secondary" href="/admin/reports">Print / PDF report</a><button className="primary" onClick={()=>setShowForm(!showForm)}><Plus size={18}/> Add member</button></div></div>

    <div className="stats"><div><small>TOTAL MEMBERS</small><strong>{totals.total}</strong></div><div><small>ACTIVE</small><strong>{totals.active}</strong></div><div><small>PENDING</small><strong>{totals.pending}</strong></div></div>
    <div className="stats"><div><small>SUSPENDED</small><strong>{totals.suspended}</strong></div><div><small>EXPIRED</small><strong>{totals.expired}</strong></div><div><small>APPROVED REVENUE</small><strong>P{totals.revenue.toLocaleString("en-BW")}</strong><span className="muted">{totals.pendingPayments} payment(s) awaiting review</span></div></div>

    {pendingRecoveries.length>0&&<section className="panel" style={{borderTop:"5px solid #f6b519"}}><div className="panel-head"><div><h2>Password recovery queue</h2><p>{pendingRecoveries.length} pending request(s)</p></div></div><div className="table-wrap"><table><thead><tr><th>Member</th><th>Member ID</th><th>Email</th><th>Requested</th><th></th></tr></thead><tbody>{pendingRecoveries.map(r=><tr key={r.id}><td><b>{r.firstName} {r.lastName}</b></td><td className="mono">{r.memberId}</td><td>{r.email}</td><td>{new Date(r.requestedAt).toLocaleString("en-BW")}</td><td><button className="text-button" onClick={()=>{const m=data.members.find(x=>x.id===r.memberId);if(m)setSelected(m)}}>Review →</button></td></tr>)}</tbody></table></div></section>}

    {showForm&&<section className="panel form-panel"><h2>New member</h2><form onSubmit={async e=>{e.preventDefault();const f=new FormData(e.currentTarget);if(await send({action:"member",firstName:f.get("firstName"),lastName:f.get("lastName"),phone:f.get("phone"),email:f.get("email"),expiresAt:f.get("expiresAt")},"Member added with pending status"))setShowForm(false)}}><div className="form-grid"><label>First name<input name="firstName" required maxLength={80}/></label><label>Last name<input name="lastName" required maxLength={80}/></label><label>Phone<input name="phone" type="tel"/></label><label>Email<input name="email" type="email"/></label><label>Expiry date<input name="expiresAt" type="date"/></label></div><div className="form-actions"><button disabled={busy} className="primary">Save member</button><button type="button" className="secondary" onClick={()=>setShowForm(false)}>Cancel</button></div></form></section>}

    <section className="panel">
     <div className="panel-head"><div><h2>Filters</h2><p>{list.length} of {data.members.length} members shown</p></div><label className="search"><Search size={18}/><input placeholder="Search name, ID, email, phone or region" value={query} onChange={e=>setQuery(e.target.value)} aria-label="Search members"/></label></div>
     <div className="form-grid">
      <label>Status<select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="all">All statuses</option><option value="active">Active</option><option value="pending">Pending</option><option value="suspended">Suspended</option><option value="expired">Expired</option></select></label>
      <label>Region<select value={regionFilter} onChange={e=>setRegionFilter(e.target.value)}><option value="all">All regions</option>{regions.map(r=><option key={r}>{r}</option>)}</select></label>
      <label>Gender<select value={genderFilter} onChange={e=>setGenderFilter(e.target.value)}><option value="all">All genders</option>{genders.map(g=><option key={g}>{g}</option>)}</select></label>
      <label>Age range<div style={{display:"flex",gap:8}}><input type="number" min="0" max="120" placeholder="Min" value={minAge} onChange={e=>setMinAge(e.target.value)}/><input type="number" min="0" max="120" placeholder="Max" value={maxAge} onChange={e=>setMaxAge(e.target.value)}/></div></label>
     </div>
    </section>

    <section className="panel"><div className="panel-head"><div><h2>Reporting centre</h2><p>Excel-compatible CSV exports and printable management report</p></div></div><div className="form-actions" style={{flexWrap:"wrap"}}><a className="secondary" href="/api/reports?type=members">Members CSV</a><a className="secondary" href="/api/reports?type=payments">Payments CSV</a><a className="secondary" href="/api/reports?type=summary">Management summary CSV</a><a className="secondary" href="/api/reports?type=audit">Audit trail CSV</a><a className="primary" href="/admin/reports">Print / Save PDF</a></div></section>

    <div className="two-col">
     <section className="panel"><h2>Members by region</h2><div className="table-wrap"><table><thead><tr><th>Region</th><th>Members</th></tr></thead><tbody>{regionSummary.map(r=><tr key={r.region}><td><b>{r.region}</b></td><td>{r.total}</td></tr>)}</tbody></table></div></section>
     <section className="panel"><h2>Payment summary</h2><dl className="details"><div><dt>Approved revenue</dt><dd>P{totals.revenue.toLocaleString("en-BW")}</dd></div><div><dt>Pending payment reviews</dt><dd>{totals.pendingPayments}</dd></div><div><dt>Total payment records</dt><dd>{data.payments.length}</dd></div></dl><a className="primary" href="/office">Open payment approvals</a></section>
    </div>

    <section className="panel"><div className="panel-head"><div><h2>Member directory</h2><p>{list.length} records</p></div></div><div className="table-wrap"><table><thead><tr><th>MEMBER</th><th>MEMBER ID</th><th>REGION</th><th>AGE</th><th>STATUS</th><th>PAYMENT</th><th>EXPIRY</th><th></th></tr></thead><tbody>{list.map(m=>{const p=latestPaymentByMember.get(m.id);return <tr key={m.id}><td><b>{m.firstName} {m.lastName}</b><br/><small>{m.email||m.phone||"—"}</small></td><td className="mono">{m.id}</td><td>{m.membershipLocation||"—"}</td><td>{ageFromDob(m.dateOfBirth)??"—"}</td><td><Badge status={effectiveStatus(m)}/></td><td>{p?<Badge status={p.status}/>:<span>—</span>}</td><td>{m.expiresAt||"—"}</td><td><button className="text-button" onClick={()=>setSelected(m)}>View →</button></td></tr>})}</tbody></table>{!list.length&&<div className="empty">{loading?"Loading members…":"No matching members."}</div>}</div></section>

    <section className="panel"><div className="panel-head"><div><h2>Recent audit trail</h2><p>Latest {Math.min(data.audits.length,25)} recorded actions</p></div><a href="/api/reports?type=audit">Download full audit CSV</a></div><div className="table-wrap"><table><thead><tr><th>Date</th><th>Actor</th><th>Role</th><th>Action</th><th>Record</th><th>Note</th></tr></thead><tbody>{data.audits.slice(0,25).map(a=><tr key={a.id}><td>{new Date(a.createdAt).toLocaleString("en-BW")}</td><td>{a.actorName||a.actorEmail||"System"}</td><td>{a.actorRole||"—"}</td><td>{a.action.replaceAll("_"," ")}</td><td>{a.entityId}</td><td>{a.note||"—"}</td></tr>)}</tbody></table>{!data.audits.length&&<div className="empty">No audit activity recorded yet.</div>}</div></section>
   </>}

   {error&&<div className="toast error" role="alert">{error}<button onClick={()=>setError("")}>×</button></div>}
   {notice&&<div className="toast" role="status">{notice}<button onClick={()=>setNotice("")}>×</button></div>}
   </div>
  </main>
 </div>;
}
