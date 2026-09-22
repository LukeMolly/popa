"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";

export default function MemberLoginClient(){
 const router=useRouter(),[busy,setBusy]=useState(false),[error,setError]=useState("");
 async function submit(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();setBusy(true);setError("");const form=new FormData(e.currentTarget);
  try{
   const response=await fetch("/api/member-session",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:form.get("email"),password:form.get("password")})});
   const data=await response.json() as {error?:string;mustChangePassword?:boolean};
   if(!response.ok)throw Error(data.error||"Sign in failed.");
   router.push(data.mustChangePassword?"/change-password":"/account");router.refresh();
  }catch(error){setError(error instanceof Error?error.message:"Sign in failed.")}finally{setBusy(false)}
 }
 return <form className="member-password-form" onSubmit={submit}>
  <label>Email address<input name="email" type="email" autoComplete="email" required placeholder="name@example.com"/></label>
  <label>4-character password<input name="password" type="password" autoComplete="current-password" required minLength={4} maxLength={4} pattern="[A-Za-z0-9]{4}" placeholder="4 letters/numbers"/></label>
  {error&&<p className="member-login-error" role="alert">{error}</p>}
  <button className="member-login-primary" disabled={busy}>{busy?"Signing in…":"Sign in"}</button>
  <a className="member-login-secondary" href="/forgot-password">Forgot password?</a>
 </form>;
}
