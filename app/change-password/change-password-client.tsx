"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ChangePasswordClient(){
  const router=useRouter(),[busy,setBusy]=useState(false),[error,setError]=useState("");
  async function submit(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();setBusy(true);setError("");const form=new FormData(e.currentTarget);
    try{
      const response=await fetch("/api/member-password",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({password:form.get("password"),confirmPassword:form.get("confirmPassword")})});
      const data=await response.json() as {error?:string};
      if(!response.ok)throw Error(data.error||"Password could not be changed.");
      router.push("/account");router.refresh();
    }catch(error){setError(error instanceof Error?error.message:"Password could not be changed.")}finally{setBusy(false)}
  }
  return <form className="member-password-form" onSubmit={submit}>
    <label>New 4-character password<input name="password" type="password" autoComplete="new-password" required minLength={4} maxLength={4} pattern="[A-Za-z0-9]{4}" placeholder="e.g. A7B2"/></label>
    <label>Confirm password<input name="confirmPassword" type="password" autoComplete="new-password" required minLength={4} maxLength={4} pattern="[A-Za-z0-9]{4}"/></label>
    <p>Use exactly 4 letters and/or numbers. Your password remains protected by one-way hashing and account lockout.</p>
    {error&&<p className="member-login-error" role="alert">{error}</p>}
    <button className="member-login-primary" disabled={busy}>{busy?"Saving…":"Save new password"}</button>
  </form>;
}
