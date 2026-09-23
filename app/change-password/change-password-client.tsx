"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ChangePasswordClient({phone,requireOtp,phoneVerified}:{phone:string;requireOtp:boolean;phoneVerified:boolean}){
 const router=useRouter(),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState(""),[otp,setOtp]=useState(""),[otpSent,setOtpSent]=useState(false);
 async function sendOtp(){
  if(!phone||!phoneVerified){setError("Verify your mobile number in the member portal first.");return}
  setBusy(true);setError("");setNotice("");
  try{const response=await fetch("/api/phone-otp/send",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({phone})});const data=await response.json() as {error?:string};if(!response.ok)throw Error(data.error||"Could not send verification code.");setOtpSent(true);setNotice("A 4-digit verification code was sent to your registered mobile number.");}catch(e){setError(e instanceof Error?e.message:"Could not send verification code.")}finally{setBusy(false)}
 }
 async function submit(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();if(requireOtp&&!/^[0-9]{4}$/.test(otp)){setError("Enter the 4-digit SMS verification code.");return}
  setBusy(true);setError("");const form=new FormData(e.currentTarget);
  try{
   const response=await fetch("/api/member-password",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({password:form.get("password"),confirmPassword:form.get("confirmPassword"),otp})});
   const data=await response.json() as {error?:string};
   if(!response.ok)throw Error(data.error||"PIN could not be changed.");
   router.push("/account");router.refresh();
  }catch(error){setError(error instanceof Error?error.message:"PIN could not be changed.")}finally{setBusy(false)}
 }
 return <form className="member-password-form" onSubmit={submit}>
  {requireOtp&&<>{!otpSent?<button type="button" className="member-login-secondary" disabled={busy||!phoneVerified} onClick={()=>void sendOtp()}>{busy?"Sending…":"Send verification code"}</button>:<>
   <label>4-digit SMS verification code<input value={otp} onChange={e=>setOtp(e.target.value.replace(/\D/g,"").slice(0,4))} inputMode="numeric" autoComplete="one-time-code" maxLength={4} placeholder="0000"/></label>
   <button type="button" className="member-login-secondary" disabled={busy} onClick={()=>void sendOtp()}>Send another code</button>
  </>}</>}
  <label>New 4-character PIN<input name="password" type="password" autoComplete="new-password" required minLength={4} maxLength={4} pattern="[A-Za-z0-9]{4}" placeholder="e.g. A7B2"/></label>
  <label>Confirm PIN<input name="confirmPassword" type="password" autoComplete="new-password" required minLength={4} maxLength={4} pattern="[A-Za-z0-9]{4}"/></label>
  <p>Use exactly 4 letters and/or numbers. Keep this PIN for normal email or mobile login until you choose to change it again.</p>
  {notice&&<p className="form-success" role="status">{notice}</p>}{error&&<p className="member-login-error" role="alert">{error}</p>}
  <button className="member-login-primary" disabled={busy||(requireOtp&&(!otpSent||otp.length!==4))}>{busy?"Saving…":"Save new PIN"}</button>
 </form>;
}
