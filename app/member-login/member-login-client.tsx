"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";

export default function MemberLoginClient(){
 const router=useRouter(),[busy,setBusy]=useState(false),[error,setError]=useState(""),[verificationEmail,setVerificationEmail]=useState(""),[resendNotice,setResendNotice]=useState(""),[verificationPhone,setVerificationPhone]=useState(""),[otp,setOtp]=useState(""),[otpSent,setOtpSent]=useState(false);
 async function submit(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();setBusy(true);setError("");setResendNotice("");const form=new FormData(e.currentTarget);
  try{
   const response=await fetch("/api/member-session",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({identifier:form.get("identifier"),password:form.get("password")})});
   const data=await response.json() as {error?:string;mustChangePassword?:boolean;needsVerification?:boolean;needsPhoneVerification?:boolean};
   if(!response.ok){const identifier=String(form.get("identifier")||"");if(data.needsVerification)setVerificationEmail(identifier);if(data.needsPhoneVerification)setVerificationPhone(identifier);throw Error(data.error||"Sign in failed.");}
   router.push(data.mustChangePassword?"/change-password":"/account");router.refresh();
  }catch(error){setError(error instanceof Error?error.message:"Sign in failed.")}finally{setBusy(false)}
 }
 async function resend(){
  if(!verificationEmail)return;
  setBusy(true);setError("");setResendNotice("");
  try{
   const response=await fetch("/api/email-verification/resend",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:verificationEmail})});
   const data=await response.json() as {error?:string;message?:string};
   if(!response.ok)throw Error(data.error||"Could not resend verification email.");
   setResendNotice(data.message||"Verification email sent.");
  }catch(error){setError(error instanceof Error?error.message:"Could not resend verification email.")}finally{setBusy(false)}
 }
 async function sendPhoneOtp(){
  if(!verificationPhone)return;setBusy(true);setError("");setResendNotice("");
  try{const response=await fetch("/api/phone-otp/send",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({phone:verificationPhone})});const data=await response.json() as {error?:string;message?:string};if(!response.ok)throw Error(data.error||"Could not send verification code.");setOtpSent(true);setResendNotice(data.message||"A 4-digit verification code was sent to your phone.");}catch(error){setError(error instanceof Error?error.message:"Could not send verification code.")}finally{setBusy(false)}
 }
 async function verifyPhoneOtp(){
  if(!/^[0-9]{4}$/.test(otp)){setError("Enter the 4-digit verification code.");return}setBusy(true);setError("");setResendNotice("");
  try{const response=await fetch("/api/phone-otp/verify",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({phone:verificationPhone,code:otp})});const data=await response.json() as {error?:string;message?:string};if(!response.ok)throw Error(data.error||"Verification failed.");setVerificationPhone("");setOtp("");setOtpSent(false);setResendNotice(data.message||"Phone number verified. You can now sign in.");}catch(error){setError(error instanceof Error?error.message:"Verification failed.")}finally{setBusy(false)}
 }
 return <form className="member-password-form" onSubmit={submit}>
  <label>Email address or mobile number<input name="identifier" type="text" autoComplete="username" required placeholder="name@example.com or +26771234567"/></label>
  <label>4-character password<input name="password" type="password" autoComplete="current-password" required minLength={4} maxLength={4} pattern="[A-Za-z0-9]{4}" placeholder="4 letters/numbers"/></label>
  {error&&<p className="member-login-error" role="alert">{error}</p>}
  {verificationEmail&&<button type="button" className="member-login-secondary" disabled={busy} onClick={()=>void resend()}>Resend verification email</button>}
  {verificationPhone&&<div className="member-phone-verification">{!otpSent?<button type="button" className="member-login-secondary" disabled={busy} onClick={()=>void sendPhoneOtp()}>Send 4-digit SMS code</button>:<><label>Verification code<input value={otp} onChange={e=>setOtp(e.target.value.replace(/\\D/g,"").slice(0,4))} inputMode="numeric" autoComplete="one-time-code" maxLength={4} placeholder="0000"/></label><button type="button" className="member-login-secondary" disabled={busy||otp.length!==4} onClick={()=>void verifyPhoneOtp()}>Verify phone number</button><button type="button" className="member-login-secondary" disabled={busy} onClick={()=>void sendPhoneOtp()}>Send another code</button></>}</div>}
  {resendNotice&&<p className="form-success" role="status">{resendNotice}</p>}
  <button className="member-login-primary" disabled={busy}>{busy?"Signing in…":"Sign in"}</button>
  <a className="member-login-secondary" href="/forgot-password">Forgot password?</a>
 </form>;
}
