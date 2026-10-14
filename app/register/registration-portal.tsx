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
    ". My Township Rollers F.C. KYC registration was saved successfully. Membership ID: " +
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
    if (paymentMethod === "other" && !paymentMethodDetail.trim()) { setError("Specify the other payment method."); return; }
    if (proofName && !paymentMethod) { setError("Choose the bank or payment method used for the attached POP."); return; }
    setBusy(true);
    setError("");
    const form = new FormData(e.currentTarget);
    form.set("gender", gender);
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

  return <main className={result ? "registration-confirmation-page" : "portal-shell"} style={result ? { minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: "28px 16px", background: "linear-gradient(145deg, #071b3b 0%, #143a75 77%, #f8b91d 77.1%, #f8b91d 100%)" } : undefined}>
    {!result && <header className="topbar">
      <a className="brand" href="/" aria-label="Township Rollers home">
        <ClubLogo/><span><strong>Township Rollers</strong><small>Member Onboarding</small></span>
      </a>
      <a href="/">Home</a>
    </header>}

    {result ? (
      <section aria-live="polite" style={{ width: "100%", maxWidth: 560 }}>
        <div style={{ background: "#fff", borderRadius: 28, borderTop: "9px solid #f8b91d", padding: "clamp(26px, 6vw, 46px) clamp(20px, 5vw, 36px)", boxShadow: "0 24px 60px rgba(0,0,0,.15)", textAlign: "center", color: "#0c244b" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}><ClubLogo/></div>
          <p style={{ fontWeight: 800, fontSize: 14, letterSpacing: 2.5, margin: "0 0 28px" }}>TOWNSHIP ROLLERS FC</p>
          <div style={{ width: 76, height: 76, borderRadius: "50%", background: "#e6f5ed", color: "#15803d", display: "grid", placeItems: "center", margin: "0 auto 22px" }}>
            <CheckCircle2 size={46} strokeWidth={2.5} aria-hidden="true"/>
          </div>
          <h1 style={{ fontSize: "clamp(26px, 6vw, 36px)", lineHeight: 1.2, fontWeight: 700, margin: "0 0 16px" }}>Registration Successful!</h1>
          <p style={{ color: "#66768a", fontSize: 16, lineHeight: 1.6, margin: "0 0 24px" }}>Thank you, {result.firstName}. Your registration has been received and is awaiting review.</p>
          <div style={{ background: "#f3f6fa", borderRadius: 14, padding: "18px 12px", marginBottom: 22 }}>
            <span style={{ display: "block", color: "#66768a", fontSize: 11, fontWeight: 800, letterSpacing: 1.5 }}>MEMBERSHIP ID</span>
            <strong style={{ display: "block", fontSize: "clamp(18px, 5vw, 24px)", margin: "8px 0", overflowWrap: "anywhere" }}>{result.membershipId}</strong>
            <span style={{ display: "inline-block", borderRadius: 18, padding: "5px 13px", fontSize: 12, fontWeight: 800, background: "#fff0c4", color: "#795000" }}>Pending Review</span>
          </div>
          <p style={{ color: "#66768a", fontSize: 14, lineHeight: 1.55, margin: "0 0 24px" }}>{result.proofUploaded ? "Your proof of payment is awaiting verification." : paymentMethod ? "Please send your proof of payment to Membership Administration." : "For payment guidance, contact Membership Administration."}</p>
          <a href={whatsAppLink} target="_blank" rel="noopener noreferrer" style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 10, background: "#f8b91d", color: "#0c244b", borderRadius: 13, padding: "16px 12px", minHeight: 54, fontSize: 15, fontWeight: 800, textDecoration: "none" }}><MessageCircle size={19} aria-hidden="true"/> Contact Membership Administration <span aria-hidden="true">→</span></a>
          <a href="/" style={{ display: "block", margin: "20px 0 24px", color: "#0c244b", fontSize: 14, fontWeight: 700, textDecoration: "none" }}>Return to POPA homepage</a>
          <div style={{ borderTop: "1px solid #e6eaf0", paddingTop: 20, color: "#88919e", fontSize: 12, letterSpacing: .3 }}>POPA POPA EA IPOPA · 2026–2027 season</div>
        </div>
      </section>
    ) : (
      <>
        <section className="hero" id="top">
          <img src="/township-rollers-team.jpeg" alt="Township Rollers players in blue and gold club kit"/>
          <div className="hero-shade"/>
          <div className="hero-copy">
            <p>POPA POPA EA IPOPA</p>
            <h1>Your club.<br/>Your membership.</h1>
            <span>Complete your KYC details to register with Township Rollers F.C.</span>
          </div>
        </section>
        <div className="workspace content-grid">
          <section className="panel form-panel">
            <div className="section-heading">
              <div>
                <span className="eyebrow">MEMBER ONBOARDING</span>
                <h2>Complete your KYC registration</h2>
                <p>Provide your details as shown on your identity document. You do not need to create an account or password.</p>
              </div>
              <span className="secure"><ShieldCheck/> KYC protected</span>
            </div>
            <form onSubmit={submit}>
              <div className="form-grid">
                <Field label="Full name"><Input name="fullName" required minLength={3} maxLength={160} placeholder="First name and surname" autoComplete="name"/></Field>
                <Field label="Omang / Passport number"><Input name="idNumber" required minLength={5} maxLength={30} placeholder="Identity number"/></Field>
                <Field label="Date of birth" hint="Select your date from the calendar">
                  <div className="date-picker-field">
                    <Input ref={dobRef} name="dateOfBirth" required type="date" min="1906-01-01" max={latestBirthDate} autoComplete="bday"/>
                    <button type="button" onClick={openDatePicker} aria-label="Open date of birth calendar"><CalendarDays/></button>
                  </div>
                </Field>
                <Field label="Place of birth"><Input name="placeOfBirth" required minLength={2} maxLength={120} placeholder="Town or village" autoComplete="address-level2"/></Field>
                <Field label="Email address"><Input name="email" required type="email" maxLength={160} defaultValue={accountEmail} placeholder="name@example.com"/></Field>
                <Field label="Mobile number" hint="Include country code, e.g. +267 7X XXX XXX"><Input name="phone" required type="tel" maxLength={20} placeholder="+267 7X XXX XXX" autoComplete="tel"/></Field>
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
                <input required type="checkbox"/> I confirm that these details are accurate and consent to their use for membership onboarding and contact by the club administration.
              </label>
              <Button type="submit" size="lg" className="submit-button" disabled={busy}>
                {busy ? "Submitting KYC…" : "Submit KYC registration"}<ChevronRight/>
              </Button>
            </form>
          </section>
          <aside className="side-stack">
            <div className="dark-card">
              <span className="eyebrow gold">WHAT HAPPENS NEXT</span>
              {[
                ["01", "Complete KYC and choose how to pay"],
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
