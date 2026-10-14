"use client";

import { useMemo, useRef, useState } from "react";
import { CalendarDays, CheckCircle2, ChevronRight, MapPin, MessageCircle, ShieldCheck, UploadCloud } from "lucide-react";
import { ClubLogo } from "../components/club-logo";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const adminWhatsApp = "26777800040";
const adminWhatsAppDisplay = "+267 77 800 040";

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}

export default function RegistrationPortal({ accountEmail }: { accountEmail: string }) {
  const dobRef = useRef<HTMLInputElement>(null);
  const [gender, setGender] = useState("");
  const [proofName, setProofName] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ membershipId: string; firstName: string; proofUploaded: boolean } | null>(null);
  const [error, setError] = useState("");
  const latestBirthDate = useMemo(() => new Date().toISOString().slice(0, 10), []);
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
    setBusy(true);
    setError("");
    const form = new FormData(e.currentTarget);
    form.set("gender", gender);
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
        <ClubLogo/><span><strong>Township Rollers</strong><small>Member Onboarding</small></span>
      </a>
      <a href="/">Home</a>
    </header>

    {result ? (
      <section className="workspace" style={{ maxWidth: 760, margin: "36px auto 80px", padding: "0 18px" }} aria-live="polite">
        <div className="panel status-panel" style={{ textAlign: "center", padding: "44px 28px" }}>
          <CheckCircle2 size={56} color="#15803d" aria-hidden="true"/>
          <span className="eyebrow" style={{ display: "block", marginTop: 14 }}>REGISTRATION SUBMITTED</span>
          <h1>Hello {result.firstName},</h1>
          <p>Your Township Rollers F.C. KYC information has been sent and saved successfully. The membership administration team will review your details.</p>
          <p><strong>Membership ID: {result.membershipId}</strong></p>
          {result.proofUploaded
            ? <p><CheckCircle2 size={18} style={{ display: "inline-block", verticalAlign: "middle", marginRight: 6 }} aria-hidden="true"/>Your proof of payment has been attached and is awaiting admin review.</p>
            : <p>No proof of payment was attached. You may contact the administrator for payment guidance.</p>}
          <p>For your membership status and all inquiries, contact the membership administrator on WhatsApp at <strong>{adminWhatsAppDisplay}</strong>. Please provide your membership ID when contacting the administrator.</p>
          <a className="submit-button" href={whatsAppLink} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 10, textDecoration: "none", marginTop: 16, padding: "14px 22px" }}>
            <MessageCircle size={20}/> Contact admin on WhatsApp
          </a>
          <p style={{ marginTop: 18 }}>No member account or login is required.</p>
          <a href="/" style={{ display: "inline-block", marginTop: 8 }}>Return to home</a>
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
                  <span className="icon-tile"><UploadCloud/></span>
                  <div>
                    <strong>Attach proof of payment (POP)</strong>
                    <p>Optional: upload your payment receipt now for review by the membership administrator.</p>
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
                <small style={{ display: "block", marginTop: 10 }}>Submitting POP is not required to complete KYC onboarding. Uploaded proof will appear in the existing administrator payment review.</small>
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
                ["01", "Complete KYC and optionally attach POP"],
                ["02", "Receive a registration reference"],
                ["03", "Contact the admin on WhatsApp"]
              ].map(([number, title]) => <div className="step" key={number}><b>{number}</b><span>{title}</span></div>)}
            </div>
            <div className="expiry-card"><MessageCircle/><div><small>MEMBERSHIP ADMIN</small><strong>{adminWhatsAppDisplay}</strong><span>Contact after submitting the form</span></div></div>
          </aside>
        </div>
      </>
    )}
    <footer><span>Township Rollers F.C. Membership</span><span><MapPin size={14}/> Botswana</span></footer>
  </main>;
}
