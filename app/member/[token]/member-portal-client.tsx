"use client";
import {useEffect,useState} from "react";
import QRCode from "qrcode";
import Link from "next/link";
import { PAYMENT_METHODS, paymentMethodLabel } from "../../../lib/payment-methods";

type Member={id:string;firstName:string;lastName:string;status:string;expiresAt:string;token:string;email:string;phone:string;emailVerifiedAt:string;phoneVerifiedAt:string;reminderDays?:number};
type Payment={id:string;amount:number;reference:string;status:string;note:string;paymentMethod?:string;paymentMethodDetail?:string;createdAt:string}|null;
type Settings={seasonName:string;membershipFee:number;expiryReminderDays:number};
type NotificationMessage={id:string;notificationId:number;senderRole:string;senderEmail:string;senderName:string;body:string;createdAt:string};
type MemberNotification={id:number;title:string;body:string;category:string;createdByRole:string;status:string;actionRequired:boolean;unread:boolean;createdAt:string;updatedAt:string;lastSenderRole:string;messages:NotificationMessage[]};
const when=(date:string)=>new Date(date).toLocaleString("en-BW",{dateStyle:"medium",timeStyle:"short"});

export default function MemberPortal({params}:{params:Promise<{token:string}>}){
 const [token,setToken]=useState(""),[member,setMember]=useState<Member|null>(null),[payment,setPayment]=useState<Payment>(null),[settings,setSettings]=useState<Settings>({seasonName:"Membership",membershipFee:200,expiryReminderDays:7}),[notifications,setNotifications]=useState<MemberNotification[]>([]),[paymentMethod,setPaymentMethod]=useState(""),[paymentMethodDetail,setPaymentMethodDetail]=useState(""),[qr,setQr]=useState(""),[error,setError]=useState(""),[success,setSuccess]=useState(""),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[notificationsLoading,setNotificationsLoading]=useState(false),[otp,setOtp]=useState(""),[otpSent,setOtpSent]=useState(false),[verifyBusy,setVerifyBusy]=useState(false);
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

 async function refreshNotifications(){
  if(!token)return;
  setNotificationsLoading(true);
  try{
   const response=await fetch("/api/member/"+encodeURIComponent(token)+"/notifications",{cache:"no-store"});
   const data=await response.json() as {notifications?:MemberNotification[];error?:string};
   if(!response.ok)throw Error(data.error||"Could not load notifications");
   setNotifications(data.notifications||[]);
  }catch(e){setError(e instanceof Error?e.message:"Could not load notifications")}finally{setNotificationsLoading(false)}
 }
 useEffect(()=>{if(!token)return;void refreshNotifications();const timer=window.setInterval(()=>void refreshNotifications(),30000);return()=>window.clearInterval(timer)},[token]);

 async function sendVerificationCode(){
  if(!member?.phone)return;setVerifyBusy(true);setError("");setSuccess("");
  try{const response=await fetch("/api/phone-otp/send",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({phone:member.phone})});const data=await response.json() as {error?:string};if(!response.ok)throw Error(data.error||"Could not send verification code.");setOtpSent(true);setSuccess("A 4-digit verification code was sent to "+member.phone+".");}catch(e){setError(e instanceof Error?e.message:"Could not send verification code.")}finally{setVerifyBusy(false)}
 }
 async function verifyMobile(){
  if(!member||!/^[0-9]{4}$/.test(otp)){setError("Enter the 4-digit verification code.");return}setVerifyBusy(true);setError("");setSuccess("");
  try{const response=await fetch("/api/phone-otp/verify",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({phone:member.phone,code:otp})});const data=await response.json() as {error?:string};if(!response.ok)throw Error(data.error||"Verification failed.");setMember({...member,phoneVerifiedAt:new Date().toISOString()});setOtp("");setOtpSent(false);setSuccess("Mobile number verified. You can now use it to sign in.");}catch(e){setError(e instanceof Error?e.message:"Verification failed.")}finally{setVerifyBusy(false)}
 }

 async function submitQuery(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();if(!token)return;setBusy(true);setError("");setSuccess("");
  const form=e.currentTarget,data=new FormData(form);
  try{
   const response=await fetch("/api/member/"+encodeURIComponent(token)+"/notifications",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"query",title:data.get("title"),body:data.get("body")})});
   const result=await response.json() as {error?:string};
   if(!response.ok)throw Error(result.error||"Could not send query");
   form.reset();setSuccess("Your query has been sent to the membership office.");await refreshNotifications();
  }catch(e){setError(e instanceof Error?e.message:"Could not send query")}finally{setBusy(false)}
 }

 async function replyNotification(notificationId:number,e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();if(!token)return;setBusy(true);setError("");setSuccess("");
  const form=e.currentTarget,data=new FormData(form);
  try{
   const response=await fetch("/api/member/"+encodeURIComponent(token)+"/notifications",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"reply",notificationId,body:data.get("body")})});
   const result=await response.json() as {error?:string};
   if(!response.ok)throw Error(result.error||"Could not send reply");
   form.reset();setSuccess("Reply sent to the membership office.");await refreshNotifications();
  }catch(e){setError(e instanceof Error?e.message:"Could not send reply")}finally{setBusy(false)}
 }

 async function resolveNotification(notificationId:number){
  if(!token)return;setBusy(true);setError("");
  try{
   const response=await fetch("/api/member/"+encodeURIComponent(token)+"/notifications",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"resolve",notificationId})});
   const result=await response.json() as {error?:string};
   if(!response.ok)throw Error(result.error||"Could not resolve conversation");
   await refreshNotifications();
  }catch(e){setError(e instanceof Error?e.message:"Could not resolve conversation")}finally{setBusy(false)}
 }

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
 const unreadNotifications=notifications.filter(n=>n.unread).length;

 return <main className="member-shell">
  <header className="member-header"><Link href="/" className="member-brand"><span className="mini-crest">TR</span><span>TOWNSHIP ROLLERS FC</span></Link><div className="member-header-actions"><span>{settings.seasonName}</span><a href="/member-logout">Sign out</a></div></header>
  <div className="member-content">
   {loading?<section className="member-panel">Loading your membership…</section>:!member?<section className="member-panel" role="alert">{error||"Member record not found."}</section>:<>
    <div className="member-heading"><div><p className="eyebrow">MY MEMBERSHIP</p><h1>{member.firstName} {member.lastName}</h1><p>Member ID {member.id}</p></div><span className={"badge "+effectiveStatus}>{effectiveStatus}</span></div>
    {effectiveStatus==="expired"?<div className="expiry-alert expired"><strong>Membership expired</strong><span>Expired on {new Date(member.expiresAt+"T00:00:00").toLocaleDateString("en-BW",{dateStyle:"long"})}. Upload proof of renewal payment below.</span></div>:effectiveStatus==="active"&&daysRemaining!==null&&daysRemaining<=Number(member.reminderDays||settings.expiryReminderDays)?<div className="expiry-alert warning"><strong>Membership expires soon</strong><span>{daysRemaining<=0?"Expires today":daysRemaining+" day"+(daysRemaining===1?"":"s")+" remaining"}.</span></div>:null}
    <section className="member-panel" style={{marginBottom:18}}>
     <p className="eyebrow">CONTACT VERIFICATION</p><h2>Sign-in contacts</h2>
     <div className="details">
      <div><dt>Email</dt><dd>{member.email||"Not provided"}</dd></div>
      <div><dt>Mobile</dt><dd>{member.phone||"Not provided"} · <strong>{member.phoneVerifiedAt?"Verified":"Unverified"}</strong></dd></div>
     </div>
     {member.phoneVerifiedAt&&<div style={{marginTop:12}}><a className="secondary" href="/change-password">Customize 4-character PIN</a><p className="muted">Changing your PIN requires a one-time SMS verification code.</p></div>}
     {!member.phoneVerifiedAt&&member.phone&&<div className="proof-form" style={{marginTop:12}}>
      <p className="muted">Verify this number once to enable mobile-number + PIN login.</p>
      {!otpSent?<button type="button" className="primary" disabled={verifyBusy} onClick={()=>void sendVerificationCode()}>{verifyBusy?"Sending…":"Verify mobile number"}</button>:<>
       <label>4-digit SMS code<input value={otp} onChange={e=>setOtp(e.target.value.replace(/\D/g,"").slice(0,4))} inputMode="numeric" autoComplete="one-time-code" maxLength={4} placeholder="0000"/></label>
       <div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button type="button" className="primary" disabled={verifyBusy||otp.length!==4} onClick={()=>void verifyMobile()}>{verifyBusy?"Verifying…":"Confirm code"}</button><button type="button" className="secondary" disabled={verifyBusy} onClick={()=>void sendVerificationCode()}>Send another code</button></div>
      </>}
     </div>}
    </section>
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

    <section className="member-panel" style={{marginTop:18}}>
     <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",flexWrap:"wrap"}}>
      <div><p className="eyebrow">MEMBER NOTIFICATIONS</p><h2 style={{margin:"4px 0"}}>Messages & queries</h2><p className="muted">Ask the membership office a question or respond to requests from the club.</p></div>
      <span className={"badge "+(unreadNotifications?"pending":"active")}>{unreadNotifications?unreadNotifications+" unread":"Up to date"}</span>
     </div>

     <form onSubmit={submitQuery} className="proof-form" style={{marginTop:16}}>
      <label>Query subject<input name="title" maxLength={160} required placeholder="e.g. Membership status, payment, personal details"/></label>
      <label>Your message<textarea name="body" required minLength={5} maxLength={2000} rows={4} placeholder="Tell the membership office how they can help."/></label>
      <button className="primary" disabled={busy}>Send query</button>
     </form>

     <div style={{display:"grid",gap:12,marginTop:18}}>
      {notificationsLoading&&<p className="muted">Loading notifications…</p>}
      {!notificationsLoading&&!notifications.length&&<p className="muted">No notifications or conversations yet.</p>}
      {notifications.map(n=><article key={n.id} style={{border:"1px solid #e3e7ef",borderRadius:12,padding:16,background:n.unread?"#fff9e8":"#fff"}}>
       <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"start",flexWrap:"wrap"}}>
        <div><small style={{textTransform:"uppercase",fontWeight:700}}>{n.category.replaceAll("_"," ")}</small><h3 style={{margin:"4px 0 6px"}}>{n.title}</h3></div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{n.actionRequired&&<span className="badge pending">Action required</span>}<span className={"badge "+(n.status==="resolved"?"active":"pending")}>{n.status}</span></div>
       </div>
       <p>{n.body}</p><small className="muted">{when(n.createdAt)}</small>
       {n.messages.map(m=><div key={m.id} style={{marginTop:10,padding:"10px 12px",borderRadius:9,background:m.senderRole==="member"?"#f6f8fb":"#eef4ff"}}>
        <strong>{m.senderRole==="member"?"You":"Membership office"}</strong><p style={{margin:"5px 0"}}>{m.body}</p><small className="muted">{when(m.createdAt)}</small>
       </div>)}
       {n.status!=="resolved"&&<form onSubmit={e=>void replyNotification(n.id,e)} style={{display:"flex",gap:8,marginTop:12,flexWrap:"wrap"}}><input name="body" required maxLength={2000} placeholder="Reply to this conversation" style={{flex:"1 1 260px"}}/><button className="secondary" disabled={busy}>Reply</button><button type="button" className="secondary" disabled={busy} onClick={()=>void resolveNotification(n.id)}>Mark resolved</button></form>}
      </article>)}
     </div>
    </section>
   </>}
  </div>
 </main>;
}
