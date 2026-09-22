"use client";
import {useEffect,useState} from "react";
import QRCode from "qrcode";
import Link from "next/link";
import { PAYMENT_METHODS, paymentMethodLabel } from "../../../lib/payment-methods";

type Member={id:string;firstName:string;lastName:string;status:string;expiresAt:string;token:string;reminderDays?:number};
type Payment={id:string;amount:number;reference:string;status:string;note:string;paymentMethod?:string;paymentMethodDetail?:string;createdAt:string}|null;
type Settings={seasonName:string;membershipFee:number;expiryReminderDays:number};
const when=(date:string)=>new Date(date).toLocaleString("en-BW",{dateStyle:"medium",timeStyle:"short"});

export default function MemberPortal({params}:{params:Promise<{token:string}>}){
 const [token,setToken]=useState(""),[member,setMember]=useState<Member|null>(null),[payment,setPayment]=useState<Payment>(null),[settings,setSettings]=useState<Settings>({seasonName:"Membership",membershipFee:200,expiryReminderDays:7}),[paymentMethod,setPaymentMethod]=useState(""),[paymentMethodDetail,setPaymentMethodDetail]=useState(""),[qr,setQr]=useState(""),[error,setError]=useState(""),[success,setSuccess]=useState(""),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 useEffect(()=>{params.then(({token})=>setToken(token))},[params]);
 useEffect(()=>{
  if(!token)return;
  fetch("/api/member/"+encodeURIComponent(token),{cache:"no-store"})
   .then(async response=>{
    const data=await response.json() as {error?:string;member:Member;payment:Payment;settings?:Settings};
    if(!response.ok)throw Error(data.error||"Member not found");
    setMember(data.member);setPayment(data.payment);if(data.settings)setSettings(data.settings);
    return QRCode.toDataURL(location.origin+"/verify/"+token,{width:320,margin:2,color:{dark:"#102b5a",light:"#ffffff"}});
   })
   .then(setQr).catch(e=>setError(e instanceof Error?e.message:"Membership unavailable.")).finally(()=>setLoading(false));
 },[token]);

 async function submit(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();setError("");setSuccess("");setBusy(true);
  try{
   const form=e.currentTarget,body=new FormData(form);
   const response=await fetch("/api/member/"+encodeURIComponent(token),{method:"POST",body});
   const result=await response.json() as {error?:string;id:string;amount?:number};
   if(!response.ok)throw Error(result.error||"Upload failed");
   setSuccess("Proof received. The membership office will review it before activation.");
   setPayment({id:result.id,amount:Number(result.amount||settings.membershipFee),reference:String(body.get("reference")||""),status:"submitted",note:"",paymentMethod:String(body.get("paymentMethod")||""),paymentMethodDetail:String(body.get("paymentMethodDetail")||""),createdAt:new Date().toISOString()});
   form.reset();setPaymentMethod("");setPaymentMethodDetail("");
  }catch(e){setError(e instanceof Error?e.message:"Upload failed")}finally{setBusy(false)}
 }

 const today=new Date().toISOString().slice(0,10);
 const effectiveStatus=member?.status==="active"&&member.expiresAt&&member.expiresAt<today?"expired":member?.status;
 const daysRemaining=member?.expiresAt?Math.ceil((new Date(member.expiresAt+"T23:59:59").getTime()-Date.now())/86400000):null;
 const selectedPayment=PAYMENT_METHODS.find(method=>method.code===paymentMethod);

 return <main className="member-shell">
  <header className="member-header"><Link href="/" className="member-brand"><span className="mini-crest">TR</span><span>TOWNSHIP ROLLERS FC</span></Link><div className="member-header-actions"><span>{settings.seasonName}</span><a href="/member-logout">Sign out</a></div></header>
  <div className="member-content">
   {loading?<section className="member-panel">Loading your membership…</section>:!member?<section className="member-panel" role="alert">{error||"Member record not found."}</section>:<>
    <div className="member-heading"><div><p className="eyebrow">MY MEMBERSHIP</p><h1>{member.firstName} {member.lastName}</h1><p>Member ID {member.id}</p></div><span className={"badge "+effectiveStatus}>{effectiveStatus}</span></div>
    {effectiveStatus==="expired"?<div className="expiry-alert expired"><strong>Membership expired</strong><span>Expired on {new Date(member.expiresAt+"T00:00:00").toLocaleDateString("en-BW",{dateStyle:"long"})}. Upload proof of renewal payment below.</span></div>:effectiveStatus==="active"&&daysRemaining!==null&&daysRemaining<=Number(member.reminderDays||settings.expiryReminderDays)?<div className="expiry-alert warning"><strong>Membership expires soon</strong><span>{daysRemaining<=0?"Expires today":daysRemaining+" day"+(daysRemaining===1?"":"s")+" remaining"}.</span></div>:null}
    <div className="member-columns">
     <section className="member-panel"><h2>Digital membership card</h2><div className="season-pass"><img className="season-art" src="/township-rollers-season-ticket.jpg" alt="Township Rollers membership card artwork"/><div className="pass-content"><span className="pass-label">MEMBERSHIP ACCESS PASS</span><strong className="pass-name">{member.firstName} {member.lastName}</strong><span className="pass-id">{member.id}</span><div className="pass-qr">{qr?<img src={qr} alt="QR code for membership verification"/>:"QR unavailable"}</div><span className={"pass-status "+effectiveStatus}>{effectiveStatus?.toUpperCase()}</span></div></div><p className="muted">The QR code verifies your current membership status.</p></section>
     <section className="member-panel">
      <h2>Membership details</h2><dl className="details"><div><dt>Member ID</dt><dd>{member.id}</dd></div><div><dt>Status</dt><dd><span className={"badge "+effectiveStatus}>{effectiveStatus}</span></dd></div><div><dt>Season</dt><dd>{settings.seasonName}</dd></div><div><dt>Expiry date</dt><dd>{member.expiresAt?new Date(member.expiresAt+"T00:00:00").toLocaleDateString("en-BW",{dateStyle:"long"}):"Not set"}</dd></div><div><dt>Membership fee</dt><dd>P{settings.membershipFee}</dd></div></dl>
      <h2>Payment</h2>{payment?<div className="payment-state"><span className={"badge "+payment.status}>{payment.status}</span><p>P{payment.amount} · Submitted {when(payment.createdAt)}</p>{payment.paymentMethod&&<p>Payment method: {paymentMethodLabel(payment.paymentMethod,payment.paymentMethodDetail)}</p>}{payment.reference&&<p>Reference: {payment.reference}</p>}{payment.note&&<p>Membership office note: {payment.note}</p>}</div>:<p className="muted">No payment submission is recorded yet.</p>}
      {effectiveStatus!=="active"&&(effectiveStatus==="expired"||!payment||payment.status==="rejected")&&<form onSubmit={submit} className="proof-form">
       <strong>Choose payment method</strong>
       <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:8}}>
        {PAYMENT_METHODS.map(method=><button key={method.code} type="button" onClick={()=>{setPaymentMethod(method.code);if(method.code!=="other")setPaymentMethodDetail("")}} style={{padding:"12px",borderRadius:9,border:paymentMethod===method.code?"2px solid #f6b519":"1px solid #d9dee8",background:paymentMethod===method.code?"#fff8df":"#fff",fontWeight:700}}>{method.label}</button>)}
       </div>
       <input type="hidden" name="paymentMethod" value={paymentMethod}/>
       {selectedPayment&&selectedPayment.code!=="other"&&<div style={{padding:12,borderRadius:9,background:"#f7f9fc",lineHeight:1.5}}><strong>{selectedPayment.accountName}</strong><br/>{selectedPayment.bankName}<br/>Account: <b>{selectedPayment.accountNumber}</b><br/>{selectedPayment.branch} · Branch code: <b>{selectedPayment.branchCode}</b><br/>SWIFT: <b>{selectedPayment.swiftCode}</b></div>}
       {paymentMethod==="other"&&<label>Other payment method<input name="paymentMethodDetail" required value={paymentMethodDetail} onChange={e=>setPaymentMethodDetail(e.target.value)} maxLength={120} placeholder="Describe how you paid"/></label>}
       <label>Payment reference (optional)<input name="reference" maxLength={100} placeholder="Transaction reference"/></label>
       <label>Proof of payment<input name="proof" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" required/></label>
       <p className="muted">P{settings.membershipFee} · JPG, PNG, WebP or PDF · maximum 5 MB</p>
       <button disabled={busy||!paymentMethod||(paymentMethod==="other"&&!paymentMethodDetail.trim())} className="primary">{busy?"Uploading…":"Submit proof for review"}</button>
      </form>}
      {success&&<p className="form-success" role="status">{success}</p>}{error&&<p className="form-error" role="alert">{error}</p>}
     </section>
    </div>
   </>}
  </div>
 </main>;
}
