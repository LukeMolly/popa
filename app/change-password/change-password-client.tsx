"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ChangePasswordClient(){
  const router=useRouter(),[busy,setBusy]=useState(false),[error,setError]=useState("");
  async function submit(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();setBusy(true);setError("");const form=new FormData(e.currentTarget);
    try{const response=await fetch("/api/member-password",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({password:form.get("password"),confirmPassword:form.get("confirmPassword")})}),data=await response.json() as {error?:string};if(!response.ok)throw Error(data.error||"Password could not be changed.");router.push("/account");router.refresh()}catch(error){setError(error instanceof Error?error.message:"Password could not be changed.")}finally{setBusy(false)}
  }
  return <form className="member-password-form" onSubmit={submit}><label>New password<input name="password" type="password" autoComplete="new-password" required minLength={8}/></label><label>Confirm new password<input name="confirmPassword" type="password" autoComplete="new-password" required minLength={8}/></label><p>Use at least 8 characters, including a letter and a number.</p>{error&&<p className="member-login-error" role="alert">{error}</p>}<button className="member-login-primary" disabled={busy}>{busy?"Saving…":"Save new password"}</button></form>;
}
