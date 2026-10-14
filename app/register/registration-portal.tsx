"use client";

import { useMemo, useRef, useState } from "react";
import { CalendarDays, CheckCircle2, ChevronRight, CreditCard, MapPin, MessageCircle, ShieldCheck, UploadCloud } from "lucide-react";
import { ClubLogo } from "../components/club-logo";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { PAYMENT_METHODS } from "../../lib/payment-methods";

const adminWhatsApp = "26777800040";
const adminWhatsAppDisplay = "+267 77 800 040";

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}

export default function RegistrationPortal({ accountEmail }: { accountEmail: string }) {
  const dobRef = useRef<HTMLInputElement>(null);
  const [gender, setGender] = useState("");
  const [localPhone, setLocalPhone] = useState("");
  const [proofName, setProofName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentMethodDetail, setPaymentMethodDetail] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ membershipId: string; firstName: string; proofUploaded: boolean } | null>(null);
  const [error, setError] = useState("");
  const latestBirthDate = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const selectedBank = PAYMENT_METHODS.find(method => method.code === paymentMethod);
  const whatsAppLink = "https://wa.me/" + adminWhatsApp + "?text=" + encodeURIComponent(
    "Hello Township Rollers Membership Admin, my name is " + (result?.firstName ?? "") +
    ". My Township Rollers F.C. membership registration was submitted successfully. Membership ID: " +
    (result?.membershipId ?? "") + ". Please assist with my membership status or enquiry."
  );

  function openDatePicker() {
    const input = dobRef.current;
    if (!input) return;
    input.focus();
    try { input.showPicker?.(); } catch { /* The native date field remains usable. */ }
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!gender) { setError("Please select your gender."); return; }
    if (!/^[0-9]{8}$/.test(localPhone)) { setError("Enter exactly eight digits after +267."); return; }
    if (paymentMethod === "other" && !paymentMethodDetail.trim()) { setError("Specify the other payment method."); return; }
    if (proofName && !paymentMethod) { setError("Choose the bank or payment method used for the attached POP."); return; }
    setBusy(true);
    setError("");
    const form = new FormData(e.currentTarget);
    form.set("gender", gender);
    form.set("phone", localPhone);
    form.set("paymentMethod", paymentMethod);
    form.set("paymentMethodDetail", paymentMethodDetail);
    try {
      const response = await fetch("/api/register", { method: "POST", body: form });
      const data = await response.json() as { membershipId?: string; firstName?: string; proofUploaded?: boolean; error?: string };
      if (!response.ok || !data.membershipId) {
        throw new Error(data.error || "Registration could not be completed.");
      }
      setResult({ membershipId: data.membershipId, firstName: data.firstName || String(form.get("fullName") || "").trim().split(/\s+/)[0] || "Member", proofUploaded: Boolean(data.proofUploaded) });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="portal-shell">
    <header className="topbar">
      <a className="brand" href="/" aria-label="Township Rollers home">
        <ClubLogo/><span><strong>Township Rollers</strong><small>Membership Registration</small></span>
      </a>
      <a href="/">Home</a>
    </header>

    {result ? (
      <section className="registration-complete-screen" aria-live="polite" aria-labelledby="registration-complete-title">
        <div className="registration-complete-card">
          <ClubLogo className="registration-complete-crest" />
          <p className="registration-complete-club">TOWNSHIP ROLLERS F.C.</p>
          <p className="registration-complete-motto">POPA POPA EA IPOPA</p>
          <div className="registration-complete-check"><CheckCircle2 size={25} aria-hidden="true" /></div>
          <p className="registration-complete-label">REGISTRATION RECEIVED</p>
          <h1 id="registration-complete-title">Thank you, <span>{result.firstName}!</span></h1>
          <p className="registration-complete-intro">Your membership registration has been received for review.</p>
          <div className="registration-complete-id">
            <span>YOUR MEMBERSHIP ID</span>
            <strong>{result.membershipId}</strong>
          </div>
          <p className="registration-complete-payment">
            {result.proofUploaded
              ? "Proof of payment attached. Verification is pending."
              : paymentMethod
                ? "Payment method recorded. Send your POP to the membership administrator."
                : "Contact the membership administrator for payment assistance."}
          </p>
          <a className="registration-complete-contact" href={whatsAppLink} target="_blank" rel="noopener noreferrer">
            <MessageCircle size={19} aria-hidden="true" />
            <span>Contact Membership Admin</span>
            <span aria-hidden="true">→</span>
          </a>
          <a className="registration-complete-home" href="/">Return to homepage</a>
          <div className="registration-complete-welcome">
            <strong>Welcome to POPA, {result.firstName}.</strong>
            <span>Your club. Your membership.</span>
          </div>
        </div>
        <p className="registration-complete-bottom">Township Rollers F.C. · 2026–2027 season</p>
      </section>
    ) : (
      <>
        <section className="hero" id="top">
          <img src="/township-rollers-team.jpeg" alt="Township Rollers players in blue and gold club kit"/>
          <div className="hero-shade"/>
          <div className="hero-copy">
            <p>POPA POPA EA IPOPA</p>
            <h1>Your club.<br/>Your membership.</h1>
            <span>Complete your membership registration with Township Rollers F.C.</span>
          </div>
        </section>
        <div className="workspace content-grid">
          <section className="panel form-panel">
            <div className="section-heading">
              <div>
                <span className="eyebrow">MEMBERSHIP REGISTRATION</span>
                <h2>Complete your membership registration</h2>
                <p>Provide your details as shown on your identity document. You do not need to create an account or password.</p>
              </div>
              <span className="secure"><ShieldCheck/> Registration protected</span>
            </div>
            <form onSubmit={submit}>
              <div className="kyc-honeypot" aria-hidden="true">
                <label htmlFor="companyWebsite">Company website</label>
                <input id="companyWebsite" name="companyWebsite" tabIndex={-1} autoComplete="off" />
              </div>
              <div className="form-grid">
                <Field label="Full name"><Input name="fullName" required minLength={3} maxLength={160} placeholder="First name and surname" autoComplete="name"/></Field>
                <Field label="Omang or Passport Number" hint="Enter your 9-digit Omang or passport number.">
                  <Input name="idNumber" required minLength={5} maxLength={30}
                    autoCapitalize="characters" placeholder="Omang or Passport Number" />
                </Field>
                <Field label="Date of birth" hint="Select your date from the calendar">
                  <div className="date-picker-field">
                    <Input ref={dobRef} name="dateOfBirth" required type="date" min="1906-01-01" max={latestBirthDate} autoComplete="bday"/>
                    <button type="button" onClick={openDatePicker} aria-label="Open date of birth calendar"><CalendarDays/></button>
                  </div>
                </Field>
                <Field label="Place of birth"><Input name="placeOfBirth" required minLength={2} maxLength={120} placeholder="Town or village" autoComplete="address-level2"/></Field>
                <Field label="Email address"><Input name="email" required type="email" maxLength={160} defaultValue={accountEmail} placeholder="name@example.com"/></Field>
                <Field label="Mobile number" hint="Botswana (+267) · enter exactly 8 digits">
                  <div className="phone-prefix-field">
                    <span className="phone-prefix" aria-label="Fixed Botswana country code">+267</span>
                    <Input name="phone" required type="tel" inputMode="numeric" pattern="[0-9]{8}"
                      minLength={8} maxLength={8} autoComplete="tel-national" placeholder="7XXXXXXX"
                      aria-label="Eight-digit Botswana mobile number" value={localPhone}
                      onChange={e=>{
                        const digits=e.target.value.replace(/\D/g,"");
                        setLocalPhone(digits.length===11&&digits.startsWith("267")?digits.slice(3):digits.slice(0,8));
                      }}/>
                  </div>
                </Field>
                <Field label="Membership location"><Input name="membershipLocation" required maxLength={100} placeholder="Enter your branch or town"/></Field>
                <Field label="Gender">
                  <RadioGroup value={gender} onValueChange={setGender} className="gender-row" required>
                    {["Female", "Male", "Other"].map(item => <label className="radio-card" key={item}><RadioGroupItem value={item.toLowerCase()}/>{item}</label>)}
                  </RadioGroup>
                </Field>
              </div>
              <div className="payment-box">
                <div className="payment-copy">
                  <span className="icon-tile"><CreditCard/></span>
                  <div>
                    <strong>Season membership payment</strong>
                    <p>The registration fee is P200. Choose a bank to view the correct account details, or register now and pay later.</p>
                  </div>
                  <b>P200</b>
                </div>
                <div className="bank-choice-section">
                  <strong>Banking / payment options</strong>
                  <div className="bank-option-grid" role="group" aria-label="Choose payment method">
                    {PAYMENT_METHODS.map(method => (
                      <button key={method.code} type="button"
                        aria-pressed={paymentMethod === method.code}
                        className={"bank-option" + (paymentMethod === method.code ? " selected" : "")}
                        onClick={() => {
                          setPaymentMethod(method.code);
                          setPaymentMethodDetail("");
                        }}
                      >
                        {method.code === "fnb" || method.code === "stanbic"
                          ? <img src={method.code === "fnb" ? "/bank-logos/fnb.png" : "/bank-logos/stanbic.png"} alt="" width={80} height={66} style={{ objectFit: "contain" }}/>
                          : <CreditCard size={30} aria-hidden="true"/>}
                        <span>{method.label}</span>
                      </button>
                    ))}
                    <button type="button" aria-pressed={!paymentMethod} className={"bank-option" + (!paymentMethod ? " selected" : "")}
                      onClick={() => { setPaymentMethod(""); setPaymentMethodDetail(""); }}>
                      <span className="bank-pay-later">Pay later</span>
                      <span>Register without payment</span>
                    </button>
                  </div>
                  {selectedBank && selectedBank.code !== "other" && (
                    <div className="bank-account-details">
                      <strong>{selectedBank.accountName}</strong>
                      <p><b>Bank:</b> {selectedBank.bankName}</p>
                      <p><b>Account number:</b> <span>{selectedBank.accountNumber}</span></p>
                      <p><b>Branch:</b> {selectedBank.branch}</p>
                      <p><b>Branch code:</b> {selectedBank.branchCode}</p>
                      <p><b>SWIFT:</b> {selectedBank.swiftCode}</p>
                    </div>
                  )}
                  {paymentMethod === "other" && <Field label="Other payment method">
                    <Input value={paymentMethodDetail} onChange={e => setPaymentMethodDetail(e.target.value)}
                      placeholder="Cash, transfer or another bank" maxLength={120} required/>
                  </Field>}
                  {paymentMethod && <Field label="Payment reference (if available)">
                    <Input name="reference" maxLength={100} placeholder="Transfer or deposit reference"/>
                  </Field>}
                </div>
                <div className="payment-copy" style={{ marginTop: 20 }}>
                  <span className="icon-tile"><UploadCloud/></span>
                  <div>
                    <strong>Attach proof of payment (POP)</strong>
                    <p>Optional: upload your receipt now or send it to the administrator afterwards.</p>
                  </div>
                </div>
                <label className="upload-zone">
                  <UploadCloud size={24} aria-hidden="true"/>
                  <span>
                    <strong>{proofName || "Choose POP attachment"}</strong>
                    <small>One PDF, JPG or PNG file · Maximum 5 MB</small>
                  </span>
                  <Input name="proof" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                    onChange={event => {
                      const file = event.currentTarget.files?.[0];
                      if (!file) { setProofName(""); return; }
                      if (file.size > 5 * 1024 * 1024 || !["application/pdf", "image/jpeg", "image/png"].includes(file.type)) {
                        event.currentTarget.value = "";
                        setProofName("");
                        setError("POP attachment must be a PDF, JPG or PNG file of 5 MB or less.");
                        return;
                      }
                      setProofName(file.name);
                      setError("");
                    }}
                  />
                </label>
                <small style={{ display: "block", marginTop: 10 }}>POP upload is optional, but selecting the bank used records a pending payment for admin review. Only confirmed payments count as received funds.</small>
              </div>
              {error && <p className="error" role="alert">{error}</p>}
              <label className="consent">
                <input required type="checkbox"/> I confirm that these details are accurate and consent to their use for membership registration and contact by the club administration.
              </label>
              <Button type="submit" size="lg" className="submit-button" disabled={busy}>
                {busy ? "Submitting registration…" : "Submit membership registration"}<ChevronRight/>
              </Button>
            </form>
          </section>
          <aside className="side-stack">
            <div className="dark-card">
              <span className="eyebrow gold">WHAT HAPPENS NEXT</span>
              {[
                ["01", "Register and choose how to pay"],
                ["02", "Optionally upload your POP"],
                ["03", "Receive your ID and contact admin"]
              ].map(([number, title]) => <div className="step" key={number}><b>{number}</b><span>{title}</span></div>)}
            </div>
            <a className="expiry-card membership-admin-whatsapp" href={"https://wa.me/" + adminWhatsApp} target="_blank" rel="noopener noreferrer" aria-label={"Chat with Township Rollers Membership Admin on WhatsApp at " + adminWhatsAppDisplay}><MessageCircle/><div><small>MEMBERSHIP ADMIN</small><strong>{adminWhatsAppDisplay}</strong><span>Click to chat on WhatsApp</span></div></a>
          </aside>
        </div>
      </>
    )}
    <footer><span>Township Rollers F.C. Membership</span><span><MapPin size={14}/> Botswana</span></footer>
  </main>;
}
