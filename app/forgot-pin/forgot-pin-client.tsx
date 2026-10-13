"use client";
import {useState} from "react";
import Link from "next/link";
export default function ForgotPinClient(){
 const [phone,setPhone]=useState(""),[code,setCode]=useState(""),[pin,setPin]=useState(""),[confirmPin,setConfirmPin]=useState(""),[sent,setSent]=useState(false),[done,setDone]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 async function send(action:"send"|"reset"){
  setBusy(true);setError("");setNotice("");
  try{
   const response=await fetch("/api/pin-recovery",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,phone,code,pin,confirmPin})});
   const data=await response.json() as {error?:string;message?:string};
   if(!response.ok)throw Error(data.error||"Please try again.");
   if(action==="send"){setSent(true);setNotice(data.message||"Check your phone for a code.");}
   else{setDone(true);setNotice("Your PIN has been changed. Please sign in.");}
  }catch(e){setError(e instanceof Error?e.message:"Request failed.")}finally{setBusy(false)}
 }
 return <div>{done?<><p role="status">{notice}</p><Link className="member-login-primary" href="/member-login">Return to member login</Link></>:<form className="member-password-form" onSubmit={e=>{e.preventDefault();void send(sent?"reset":"send")}}>
  <label>Registered Botswana mobile number<input type="tel" inputMode="tel" autoComplete="tel-national" required value={phone} onChange={e=>setPhone(e.target.value)} placeholder="71234567" disabled={sent}/></label>
  {sent&&<><label>4-digit SMS verification code<input type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{4}" maxLength={4} required value={code} onChange={e=>setCode(e.target.value)}/></label><label>New 4-character PIN<input type="password" autoComplete="new-password" minLength={4} maxLength={4} pattern="[A-Za-z0-9]{4}" required value={pin} onChange={e=>setPin(e.target.value)}/></label><label>Confirm new PIN<input type="password" autoComplete="new-password" minLength={4} maxLength={4} pattern="[A-Za-z0-9]{4}" required value={confirmPin} onChange={e=>setConfirmPin(e.target.value)}/></label></>}
  {notice&&<p role="status">{notice}</p>}{error&&<p role="alert" className="member-login-error">{error}</p>}
  <button type="submit" className="member-login-primary" disabled={busy}>{busy?"Processing…":sent?"Verify code and reset PIN":"Send recovery code"}</button>
  {sent&&<button type="button" disabled={busy} onClick={()=>{setSent(false);setCode("");setNotice("")}}>Start again</button>}
 </form>}<p>Never share your verification code or PIN. Codes expire after five minutes.</p></div>;
}
