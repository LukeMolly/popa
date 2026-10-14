"use client";
import { useCallback, useEffect, useState } from "react";
type Role = "executive" | "membership" | "operations" | "coach";
type Administrator = { email:string; name:string; role:Role; active:number; permanent?:boolean };
const labels:Record<Role,string>={executive:"Executive Access",membership:"Membership",operations:"Operations",coach:"Coach"};
const responsibilities:Record<Role,string>={executive:"Full access and administrator management",membership:"Members, payments, expiry, notifications and promotional codes",operations:"Fixtures, results and standings",coach:"Squad, contracts, Starting XI and substitutions"};
export default function AdminAccessClient(){
 const [admins,setAdmins]=useState<Administrator[]>([]),[error,setError]=useState(""),[notice,setNotice]=useState(""),[loading,setLoading]=useState(true);
 const load=useCallback(async()=>{try{const r=await fetch("/api/admins",{cache:"no-store"}),d=await r.json();if(!r.ok)throw Error(d.error);setAdmins(d.administrators);setError("")}catch(e){setError(e instanceof Error?e.message:"Could not load administrators")}finally{setLoading(false)}},[]);
 useEffect(()=>{void load()},[load]);
 async function save(payload:Record<string,unknown>){setError("");setNotice("");try{const r=await fetch("/api/admins",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)}),d=await r.json();if(!r.ok)throw Error(d.error);setNotice(payload.action==="delete"?"Administrator removed.":payload.action==="rotate-executive-pin"?"Executive PIN changed. Existing PIN sessions have been signed out.":"Administrator access saved.");await load()}catch(e){setError(e instanceof Error?e.message:"Could not save administrator")}}
 return <main className="office-page admin-access-page">
  <div className="office-top"><a href="/office">← Club office</a><a href="/admin">Member registry</a></div>
  <div className="member-heading"><div><p className="eyebrow">EXECUTIVE CONTROL</p><h1>Administrator access</h1><p>Assign each official only the club functions they are responsible for.</p></div></div>
  {error&&<p className="form-error" role="alert">{error}</p>}{notice&&<p className="form-success" role="status">{notice}</p>}
  <div className="admin-role-grid">{(["coach","membership","operations","executive"] as Role[]).map(role=><article className={"admin-role-card "+role} key={role}><span>{labels[role]}</span><p>{responsibilities[role]}</p></article>)}</div>
  <section className="member-panel"><h2>Add or update administrator</h2><form className="office-form admin-access-form" onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);void save({action:"save",name:f.get("name"),email:f.get("email"),role:f.get("role"),pin:f.get("pin"),active:true});e.currentTarget.reset()}}><label>Full name<input name="name" required maxLength={100}/></label><label>Authorised email<input name="email" type="email" required maxLength={160}/></label><label>Six-digit PIN<input name="pin" type="password" inputMode="numeric" pattern="[0-9]{6}" minLength={6} maxLength={6} required autoComplete="new-password"/></label><label>Administrator role<select name="role" defaultValue="coach"><option value="coach">Coach administrator</option><option value="membership">Membership administrator</option><option value="operations">Operations administrator</option></select></label><button className="primary">Save administrator</button></form><p className="hint">Share the PIN privately. The administrator signs in using this authorised email and six-digit PIN.</p></section>
  <section className="member-panel">
    <h2>Change permanent executive PIN</h2>
    <p className="muted">Replace the executive PIN with a new six-digit code. This revokes existing executive PIN sessions without changing the permanent account.</p>
    <form className="office-form admin-access-form" onSubmit={async e=>{
      e.preventDefault();
      const form=e.currentTarget;
      const values=new FormData(form);
      const oldPin=String(values.get("oldPin")||"");
      const newPin=String(values.get("newPin")||"");
      const confirmPin=String(values.get("confirmPin")||"");
      if(newPin!==confirmPin){setError("The two new PINs do not match.");return;}
      await save({action:"rotate-executive-pin",oldPin,newPin});
      form.reset();
    }}>
      <label>Current executive PIN<input type="password" name="oldPin" inputMode="numeric" autoComplete="current-password" minLength={6} maxLength={6} pattern="[0-9]{6}" required/></label>
      <label>New executive PIN<input type="password" name="newPin" inputMode="numeric" autoComplete="new-password" minLength={6} maxLength={6} pattern="[0-9]{6}" required/></label>
      <label>Confirm new PIN<input type="password" name="confirmPin" inputMode="numeric" autoComplete="new-password" minLength={6} maxLength={6} pattern="[0-9]{6}" required/></label>
      <button className="primary" type="submit">Change executive PIN</button>
    </form>
  </section>
  <section className="member-panel"><div className="panel-head"><div><h2>Current administrators</h2><p>{admins.length} accounts</p></div></div>{loading?<p>Loading administrators…</p>:<div className="table-wrap"><table><thead><tr><th>Administrator</th><th>Email</th><th>Role</th><th>Access</th><th></th></tr></thead><tbody>{admins.map(a=><tr key={a.email}><td><b>{a.name}</b></td><td>{a.email}</td><td><span className={"admin-role-badge "+a.role}>{labels[a.role]}</span></td><td>{a.active?"Active":"Disabled"}</td><td>{a.permanent?<small>Permanent executive</small>:<button className="danger-button" onClick={()=>{if(confirm(`Remove ${a.name}'s administrator access?`))void save({action:"delete",email:a.email})}}>Remove</button>}</td></tr>)}</tbody></table></div>}</section>
 </main>
}
