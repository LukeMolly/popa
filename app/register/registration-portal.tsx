"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell, CalendarDays, ChevronRight, CreditCard, FileCheck2, MapPin, ShieldCheck, UploadCloud, UserRound } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

type Notice = { title: string; body: string; date: string; kind: string };
const locations = ["Gaborone", "Molepolole", "Mochudi", "Francistown", "Maun", "Palapye", "Lobatse", "Other"];

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}

export default function Portal({ accountEmail }: { accountEmail: string }) {
  const [active, setActive] = useState("register");
  const [gender, setGender] = useState("");
  const [location, setLocation] = useState("");
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ membershipId: string; expiresAt: string } | null>(null);
  const [error, setError] = useState("");
  const [notices, setNotices] = useState<Notice[]>([
    { title: "Welcome to the Popa family", body: "Complete your registration and upload proof of payment for verification.", date: "Today", kind: "Member update" },
    { title: "Season membership", body: "The once-off P200 membership covers the September 2026 to July 2027 season.", date: "Membership desk", kind: "Payment" },
  ]);
  const [draft, setDraft] = useState("");
  const expiry = useMemo(() => new Intl.DateTimeFormat("en-BW", { day: "2-digit", month: "short", year: "numeric" }).format(new Date("2027-07-31T23:59:59")), []);

  useEffect(() => {
    const ctx = (document as Document & { modelContext?: { registerTool?: (tool: unknown, options?: { signal?: AbortSignal }) => void | Promise<void> } }).modelContext;
    if (!ctx?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(ctx.registerTool({ name: "start_membership_registration", title: "Start membership registration", description: "Open the Township Rollers membership registration form.", inputSchema: { type: "object", properties: {}, additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false }, execute: async () => { setActive("register"); window.scrollTo({ top: 0, behavior: "smooth" }); return { view: "registration" }; } }, { signal: lifecycle.signal })).catch(() => undefined);
    return () => lifecycle.abort();
  }, []);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setError("");
    const form = new FormData(e.currentTarget); form.set("gender", gender); form.set("membershipLocation", location);
    try {
      const response = await fetch("/api/register", { method: "POST", body: form });
      const data = await response.json() as { membershipId?: string; expiresAt?: string; error?: string };
      if (!response.ok || !data.membershipId || !data.expiresAt) throw new Error(data.error || "Registration could not be completed.");
      setResult({ membershipId: data.membershipId, expiresAt: data.expiresAt }); setActive("membership");
    } catch (err) { setError(err instanceof Error ? err.message : "Registration could not be completed."); }
    finally { setBusy(false); }
  }

  function publishNotice() { const body = draft.trim(); if (!body) return; setNotices(current => [{ title: "Club communication", body, date: "Just now", kind: "Official notice" }, ...current]); setDraft(""); }

  return <main className="portal-shell">
    <header className="topbar"><a className="brand" href="#top" aria-label="Township Rollers Membership home"><span className="crest">TR</span><span><strong>Township Rollers</strong><small>Membership Portal</small></span></a><button className="notice-button" onClick={() => setActive("notices")} aria-label="Open notifications"><Bell size={19}/><span>{notices.length}</span></button></header>
    <section className="hero" id="top"><img src="/township-rollers-team.jpeg" alt="Township Rollers players in blue and gold club kit"/><div className="hero-shade"/><div className="hero-copy"><p>POPA POPA EA IPOPA</p><h1>Your club.<br/>Your membership.</h1><span>Register, renew and stay connected.</span></div><div className="price-card"><small>SEASON MEMBERSHIP</small><strong>P200</strong><span><CalendarDays size={16}/> Sep 2026 – Jul 2027</span></div></section>
    <Tabs value={active} onValueChange={setActive} className="workspace">
      <TabsList className="portal-tabs" aria-label="Portal sections"><TabsTrigger value="register"><UserRound/>Register</TabsTrigger><TabsTrigger value="membership"><CreditCard/>My membership</TabsTrigger><TabsTrigger value="notices"><Bell/>Club notices</TabsTrigger></TabsList>
      <TabsContent value="register" className="content-grid">
        <section className="panel form-panel"><div className="section-heading"><div><span className="eyebrow">ACCOUNT OPENING</span><h2>Become a registered member</h2><p>Enter your personal details exactly as they appear on your identity document.</p></div><span className="secure"><ShieldCheck/> KYC protected</span></div>
          <form onSubmit={submit}><div className="form-grid">
            <Field label="Full name"><Input name="fullName" required placeholder="First name and surname" autoComplete="name"/></Field><Field label="Omang / Passport number"><Input name="idNumber" required placeholder="Identity number"/></Field>
            <Field label="Date of birth"><Input name="dateOfBirth" required type="date"/></Field><Field label="Place of birth"><Input name="placeOfBirth" required placeholder="Town or village"/></Field>
            <Field label="Email address"><Input name="email" required type="email" defaultValue={accountEmail} placeholder="name@example.com"/></Field><Field label="Mobile number"><Input name="phone" required type="tel" placeholder="+267 7X XXX XXX"/></Field>
            <Field label="Create password"><Input name="password" required type="password" minLength={8} autoComplete="new-password" placeholder="8+ characters, letter and number"/></Field><Field label="Confirm password"><Input name="confirmPassword" required type="password" minLength={8} autoComplete="new-password" placeholder="Repeat password"/></Field>
            <Field label="Membership location"><Select value={location} onValueChange={setLocation} required><SelectTrigger className="select-full membership-location"><SelectValue placeholder="Select branch or town"/></SelectTrigger><SelectContent className="location-menu">{locations.map(item => <SelectItem className="location-option" key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></Field>
            <Field label="Gender"><RadioGroup value={gender} onValueChange={setGender} className="gender-row" required>{["Female", "Male", "Other"].map(item => <label className="radio-card" key={item}><RadioGroupItem value={item.toLowerCase()}/>{item}</label>)}</RadioGroup></Field>
          </div>
          <div className="payment-box"><div className="payment-copy"><span className="icon-tile"><CreditCard/></span><div><strong>Season registration fee</strong><p>A once-off P200 payment covers September 2026 to July 2027.</p></div><b>P200</b></div><label className="upload-zone"><UploadCloud/><span><strong>{fileName || "Upload proof of payment"}</strong><small>PDF, JPG or PNG · Maximum 5 MB</small></span><Input name="proof" required type="file" accept=".pdf,image/jpeg,image/png" onChange={e => setFileName(e.target.files?.[0]?.name || "")}/></label></div>
          {error && <p className="error" role="alert">{error}</p>}<label className="consent"><input required type="checkbox"/> I confirm that these details are accurate and consent to their use for membership verification and communication.</label><Button type="submit" size="lg" className="submit-button" disabled={busy}>{busy ? "Submitting…" : "Submit registration"}<ChevronRight/></Button></form>
        </section>
        <aside className="side-stack"><div className="dark-card"><span className="eyebrow gold">WHAT HAPPENS NEXT</span>{[["01","Submit KYC details"],["02","Payment is verified"],["03","Membership is activated"]].map(([n,t]) => <div className="step" key={n}><b>{n}</b><span>{t}</span></div>)}</div><div className="expiry-card"><CalendarDays/><div><small>SEASON EXPIRY</small><strong>{expiry}</strong><span>September 2026 – July 2027</span></div></div></aside>
      </TabsContent>
      <TabsContent value="membership" className="member-view"><section className="digital-card"><div className="card-top"><span className="crest small">TR</span><span>2026 / 27</span></div><p>TOWNSHIP ROLLERS F.C.</p><h2>{result ? "Membership submitted" : "Your digital membership"}</h2><div className="card-details"><div><small>MEMBERSHIP ID</small><strong>{result?.membershipId || "Register to receive your ID"}</strong></div><div><small>STATUS</small><strong className="status"><i/>{result ? "Pending verification" : "Not registered"}</strong></div></div></section><section className="panel status-panel"><span className="eyebrow">MEMBERSHIP STATUS</span><h2>{result ? "We are verifying your payment" : "Start your membership"}</h2><p>{result ? "Your application has been saved. The membership desk will confirm your payment and activate your season access through July 2027." : "Complete the registration form and upload proof of your once-off P200 season payment."}</p><div className="status-row"><FileCheck2/><span><small>Payment proof</small><strong>{result ? "Received" : "Not submitted"}</strong></span></div><div className="status-row"><CalendarDays/><span><small>Season expiry</small><strong>{result ? new Date(result.expiresAt).toLocaleDateString("en-BW", { day:"2-digit", month:"long", year:"numeric" }) : expiry}</strong></span></div>{!result && <Button onClick={() => setActive("register")}>Register now</Button>}</section></TabsContent>
      <TabsContent value="notices" className="notices-view"><section className="panel notice-panel"><span className="eyebrow">INTERNAL COMMUNICATION</span><h2>Club notices</h2><div className="notice-list">{notices.map((item,index)=><article className="notice" key={item.title+index}><span className="notice-icon"><Bell/></span><div><small>{item.kind} · {item.date}</small><h3>{item.title}</h3><p>{item.body}</p></div></article>)}</div></section><aside className="panel compose"><span className="eyebrow">ADMIN PREVIEW</span><h2>Send an update</h2><p>Publish an internal message to members.</p><textarea value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Type a membership update…"/><Button onClick={publishNotice} disabled={!draft.trim()}>Publish notice</Button></aside></TabsContent>
    </Tabs><footer><span>Township Rollers F.C. Membership</span><span><MapPin size={14}/> Botswana</span></footer>
  </main>;
}
