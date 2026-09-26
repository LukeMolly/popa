"use client";
import {useState} from "react";

export default function ForgotPasswordClient(){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(""),[error,setError]=useState("");
 async function submit(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();
  const formElement=e.currentTarget;
  const form=new FormData(formElement);
  setBusy(true);setMessage("");setError("");
  try{
   const response=await fetch("/api/password-recovery",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({email:form.get("email"),memberId:form.get("memberId")})
   });
   const data=await response.json() as {message?:string};
   if(!response.ok)throw Error("Could not submit recovery request.");
   setMessage(data.message||"Recovery request submitted.");
   formElement.reset();
  }catch(err){
   setError(err instanceof Error?err.message:"Could not submit recovery request.");
  }finally{
   setBusy(false);
  }
 }
 return <form className="member-password-form" onSubmit={submit}>
  <label>Membership ID<input name="memberId" required placeholder="TRFC-XXXXXXXX" maxLength={20}/></label>
  <label>Email address<input name="email" type="email" required autoComplete="email" placeholder="name@example.com"/></label>
  <p>Your request is sent to the membership office. An administrator will issue a one-time 4-character code that must be changed after sign-in.</p>
  {message&&<p className="form-success" role="status">{message}</p>}
  {error&&<p className="member-login-error" role="alert">{error}</p>}
  <button className="member-login-primary" disabled={busy}>{busy?"Submitting…":"Request password recovery"}</button>
  <a className="member-login-secondary" href="/member-login">Back to member login</a>
 </form>;
}
