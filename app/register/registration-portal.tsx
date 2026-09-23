"use client";

import {useMemo,useRef,useState} from "react";
import {CalendarDays,ChevronRight,CreditCard,FileCheck2,MapPin,ShieldCheck,UploadCloud,UserRound} from "lucide-react";
import {Tabs,TabsContent,TabsList,TabsTrigger} from "@/components/ui/tabs";
import {Input} from "@/components/ui/input";
import {Button} from "@/components/ui/button";
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from "@/components/ui/select";
import {RadioGroup,RadioGroupItem} from "@/components/ui/radio-group";
import type { MembershipSettings } from "../../lib/membership";
import { PAYMENT_METHODS } from "../../lib/payment-methods";

const locations=["Gaborone","Molepolole","Mochudi","Francistown","Maun","Palapye","Lobatse","Other"];
const countryCodes=[["Botswana","+267"],["South Africa","+27"],["Zimbabwe","+263"],["Zambia","+260"],["Namibia","+264"],["Lesotho","+266"],["Eswatini","+268"],["Other",""]];

function Field({label,children,hint}:{label:string;children:React.ReactNode;hint?:string}){
 return <label className="field"><span>{label}</span>{children}{hint&&<small>{hint}</small>}</label>;
}
function niceDate(value:string){return new Intl.DateTimeFormat("en-BW",{day:"2-digit",month:"short",year:"numeric"}).format(new Date(value+"T12:00:00"))}

export default function Portal({accountEmail,settings}:{accountEmail:string;settings:MembershipSettings}){
 const dobRef=useRef<HTMLInputElement>(null);
 const [active,setActive]=useState("register"),[gender,setGender]=useState(""),[location,setLocation]=useState(""),[paymentMethod,setPaymentMethod]=useState(""),[paymentMethodDetail,setPaymentMethodDetail]=useState(""),[fileName,setFileName]=useState(""),[busy,setBusy]=useState(false),[result,setResult]=useState<{membershipId:string;expiresAt:string;verificationEmailSent:boolean}|null>(null),[error,setError]=useState(""),[accountMethod,setAccountMethod]=useState<"email"|"phone">("email"),[countryCode,setCountryCode]=useState("+267"),[phone,setPhone]=useState(""),[otp,setOtp]=useState(""),[otpSent,setOtpSent]=useState(false),[phoneVerified,setPhoneVerified]=useState(false),[otpNotice,setOtpNotice]=useState("");
 const latestBirthDate=useMemo(()=>new Date().toISOString().slice(0,10),[]);
 const selectedPayment=PAYMENT_METHODS.find(method=>method.code===paymentMethod);

 function openDatePicker(){const input=dobRef.current;if(!input)return;input.focus();try{input.showPicker?.()}catch{}}
 async function sendOtp(){
  setBusy(true);setError("");setOtpNotice("");
  try{const response=await fetch("/api/phone-otp/send",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({phone:countryCode+phone})});const data=await response.json() as {ok?:boolean;error?:string;remainingToday?:number};if(!response.ok||!data.ok)throw Error(data.error||"Could not send verification code.");setOtpSent(true);setPhoneVerified(false);setOtpNotice("4-digit code sent. "+String(data.remainingToday??0)+" send(s) remaining today.");}catch(err){setError(err instanceof Error?err.message:"Could not send verification code.")}finally{setBusy(false)}
 }
 async function verifyOtp(){
  setBusy(true);setError("");
  try{const response=await fetch("/api/phone-otp/verify",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({phone:countryCode+phone,code:otp})});const data=await response.json() as {ok?:boolean;error?:string};if(!response.ok||!data.ok)throw Error(data.error||"Verification failed.");setPhoneVerified(true);setOtpNotice("Phone number verified.");}catch(err){setError(err instanceof Error?err.message:"Verification failed.")}finally{setBusy(false)}
 }
 async function submit(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();setBusy(true);setError("");
  const form=new FormData(e.currentTarget);form.set("gender",gender);form.set("membershipLocation",location);form.set("paymentMethod",paymentMethod);form.set("paymentMethodDetail",paymentMethodDetail);form.set("accountMethod",accountMethod);form.set("countryCode",countryCode);form.set("phone",countryCode+phone);if(accountMethod==="phone"&&!phoneVerified){setBusy(false);setError("Verify your phone number before submitting.");return;}
  try{
   const response=await fetch("/api/register",{method:"POST",body:form});
   const data=await response.json() as {membershipId?:string;expiresAt?:string;error?:string;verificationEmailSent?:boolean};
   if(!response.ok||!data.membershipId||!data.expiresAt)throw new Error(data.error||"Registration could not be completed.");
   setResult({membershipId:data.membershipId,expiresAt:data.expiresAt,verificationEmailSent:Boolean(data.verificationEmailSent)});setActive("membership");
  }catch(err){setError(err instanceof Error?err.message:"Registration could not be completed.")}finally{setBusy(false)}
 }

 return <main className="portal-shell">
  <header className="topbar"><a className="brand" href="/" aria-label="Township Rollers Membership home"><span className="crest">TR</span><span><strong>Township Rollers</strong><small>Membership Portal</small></span></a><a href="/member-login">Member login</a></header>

  <section className="hero" id="top"><img src="/township-rollers-team.jpeg" alt="Township Rollers players in blue and gold club kit"/><div className="hero-shade"/><div className="hero-copy"><p>POPA POPA EA IPOPA</p><h1>Your club.<br/>Your membership.</h1><span>Register, pay and manage your membership.</span></div><div className="price-card"><small>{settings.seasonName} MEMBERSHIP</small><strong>P{settings.membershipFee}</strong><span><CalendarDays size={16}/> {niceDate(settings.seasonStartDate)} – {niceDate(settings.seasonEndDate)}</span></div></section>

  <Tabs value={active} onValueChange={setActive} className="workspace">
   <TabsList className="portal-tabs" aria-label="Portal sections"><TabsTrigger value="register"><UserRound/>Register</TabsTrigger><TabsTrigger value="membership"><CreditCard/>My membership</TabsTrigger></TabsList>
   <TabsContent value="register" className="content-grid">
    <section className="panel form-panel">
     <div className="section-heading"><div><span className="eyebrow">ACCOUNT OPENING</span><h2>Become a registered member</h2><p>Enter your personal details exactly as they appear on your identity document.</p></div><span className="secure"><ShieldCheck/> KYC protected</span></div>
     {!settings.registrationOpen&&<p className="error">New registrations are currently closed by the membership office.</p>}
     <form onSubmit={submit}>
      <div className="form-grid">
       <Field label="Full name"><Input name="fullName" required minLength={3} maxLength={160} placeholder="First name and surname" autoComplete="name"/></Field>
       <Field label="Omang / Passport number"><Input name="idNumber" required minLength={5} maxLength={30} pattern="[A-Za-z0-9][A-Za-z0-9/-]{4,29}" placeholder="Identity number"/></Field>
       <Field label="Date of birth" hint="Select your date from the calendar"><div className="date-picker-field"><Input ref={dobRef} name="dateOfBirth" required type="date" min="1906-01-01" max={latestBirthDate} autoComplete="bday"/><button type="button" onClick={openDatePicker} aria-label="Open date of birth calendar"><CalendarDays/></button></div></Field>
       <Field label="Place of birth"><Input name="placeOfBirth" required minLength={2} maxLength={120} placeholder="Town or village"/></Field>
       <Field label="Email address"><Input name="email" required type="email" maxLength={160} defaultValue={accountEmail} placeholder="name@example.com"/></Field>
       <Field label="Mobile number"><div className="botswana-phone-field"><Select value={countryCode} onValueChange={value=>{setCountryCode(value);setPhoneVerified(false);setOtpSent(false)}}><SelectTrigger className="country-code-trigger" aria-label="Country code"><SelectValue/></SelectTrigger><SelectContent>{countryCodes.filter(([,code])=>Boolean(code)).map(([country,code])=><SelectItem key={country} value={code}>{country} ({code})</SelectItem>)}</SelectContent></Select><Input required type="tel" inputMode="numeric" value={phone} onChange={e=>{setPhone(e.target.value.replace(/\D/g,""));setPhoneVerified(false)}} pattern="[0-9]{7,12}" maxLength={12} placeholder={countryCode==="+267"?"7X XXX XXX":"Mobile number"}/></div></Field>\n       <Field label="Create 4-character password" hint="Exactly 4 letters and/or numbers"><Input name="password" required type="password" minLength={4} maxLength={4} pattern="[A-Za-z0-9]{4}" autoComplete="new-password" placeholder="e.g. A7B2"/></Field>
       <Field label="Confirm password"><Input name="confirmPassword" required type="password" minLength={4} maxLength={4} pattern="[A-Za-z0-9]{4}" autoComplete="new-password" placeholder="Repeat password"/></Field>
       <Field label="Membership location"><Select value={location} onValueChange={setLocation} required><SelectTrigger className="select-full membership-location"><SelectValue placeholder="Select branch or town"/></SelectTrigger><SelectContent className="location-menu">{locations.map(item=><SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></Field>
       <Field label="Gender"><RadioGroup value={gender} onValueChange={setGender} className="gender-row" required>{["Female","Male","Other"].map(item=><label className="radio-card" key={item}><RadioGroupItem value={item.toLowerCase()}/>{item}</label>)}</RadioGroup></Field>
      </div>
      <div className="payment-box">
       <div className="payment-copy"><span className="icon-tile"><CreditCard/></span><div><strong>Season registration fee</strong><p>A once-off P{settings.membershipFee} payment covers the configured membership season.</p></div><b>P{settings.membershipFee}</b></div>
       <div style={{margin:"18px 0"}}>
        <strong style={{display:"block",marginBottom:8}}>Choose where/how you paid</strong>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:10}}>
         {PAYMENT_METHODS.map(method=><button key={method.code} type="button" className={`payment-method payment-${method.code}${paymentMethod===method.code?" selected":""}`} onClick={()=>{setPaymentMethod(method.code);if(method.code!=="other")setPaymentMethodDetail("")}}>{method.label}</button>)}
        </div>
        <input type="hidden" name="paymentMethod" value={paymentMethod}/>
        {selectedPayment&&selectedPayment.code!=="other"&&<div className={`bank-details bank-${selectedPayment.code}`}>
         <strong>{selectedPayment.accountName}</strong><br/>
         <span>{selectedPayment.bankName}</span><br/>
         <span>Account: <b>{selectedPayment.accountNumber}</b></span><br/>
         <span>{selectedPayment.branch} · Branch code: <b>{selectedPayment.branchCode}</b></span><br/>
         <span>SWIFT: <b>{selectedPayment.swiftCode}</b></span>
        </div>}
        {paymentMethod==="other"&&<label style={{display:"block",marginTop:12}}>Other payment method<input name="paymentMethodDetail" required value={paymentMethodDetail} onChange={e=>setPaymentMethodDetail(e.target.value)} maxLength={120} placeholder="e.g. cash deposit, mobile transfer, other bank"/></label>}
        {!paymentMethod&&<small style={{display:"block",marginTop:8}}>Select FNB, Stanbic Bank or Other before uploading proof.</small>}
       </div>
       <label style={{display:"block",marginBottom:12}}>Payment reference (optional)<Input name="reference" maxLength={100} placeholder="Transaction / deposit reference"/></label>
       <label className="upload-zone"><UploadCloud/><span><strong>{fileName||"Upload proof of payment"}</strong><small>PDF, JPG or PNG · Maximum 5 MB</small></span><Input name="proof" required type="file" accept=".pdf,image/jpeg,image/png" onChange={e=>setFileName(e.target.files?.[0]?.name||"")}/></label>
      </div>
      {error&&<p className="error" role="alert">{error}</p>}
      <label className="consent"><input required type="checkbox"/> I confirm that these details are accurate and consent to their use for membership verification and communication.</label>
      <Button type="submit" size="lg" className="submit-button" disabled={busy||!settings.registrationOpen||!paymentMethod||(paymentMethod==="other"&&!paymentMethodDetail.trim())}>{busy?"Submitting…":"Submit registration"}<ChevronRight/></Button>
     </form>
    </section>
    <aside className="side-stack"><div className="dark-card"><span className="eyebrow gold">WHAT HAPPENS NEXT</span>{[["01","Submit KYC details"],["02","Submit payment proof"],["03","Payment is verified"],["04","Membership is activated"]].map(([n,t])=><div className="step" key={n}><b>{n}</b><span>{t}</span></div>)}</div><div className="expiry-card"><CalendarDays/><div><small>SEASON EXPIRY</small><strong>{niceDate(settings.seasonEndDate)}</strong><span>{settings.seasonName}</span></div></div></aside>
   </TabsContent>

   <TabsContent value="membership" className="member-view">
    <section className="digital-card"><div className="card-top"><span className="crest small">TR</span><span>{settings.seasonName}</span></div><p>TOWNSHIP ROLLERS F.C.</p><h2>{result?"Membership submitted":"Your digital membership"}</h2><div className="card-details"><div><small>MEMBERSHIP ID</small><strong>{result?.membershipId||"Register to receive your ID"}</strong></div><div><small>STATUS</small><strong className="status"><i/>{result?"Pending verification":"Not registered"}</strong></div></div></section>
    <section className="panel status-panel"><span className="eyebrow">MEMBERSHIP STATUS</span><h2>{result?"Registration received":"Start your membership"}</h2><p>{result?"Your application has been saved. The membership office will confirm your payment before activating your membership.":"Complete the registration form and upload proof of payment."}</p><div className="status-row"><FileCheck2/><span><small>Payment proof</small><strong>{result?"Received":"Not submitted"}</strong></span></div><div className="status-row"><CalendarDays/><span><small>Season expiry</small><strong>{result?new Date(result.expiresAt).toLocaleDateString("en-BW",{day:"2-digit",month:"long",year:"numeric"}):niceDate(settings.seasonEndDate)}</strong></span></div>{!result&&<Button onClick={()=>setActive("register")}>Register now</Button>}</section>
   </TabsContent>
  </Tabs>
  <footer><span>Township Rollers F.C. Membership</span><span><MapPin size={14}/> Botswana</span></footer>
 </main>;
}
