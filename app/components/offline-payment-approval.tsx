"use client";
import {useState} from "react";

type OfflineProof = {
  method:string;
  methodDetail:string;
  proofChannel:string;
  reference:string;
  note:string;
};
type OfflinePaymentMember = {
  id:string;
  firstName:string;
  lastName:string;
  status:string;
  riskStatus:string;
  paymentStatus:string|null;
};

export default function OfflinePaymentApproval({
  member,onApprove
}:{
  member:OfflinePaymentMember;
  onApprove:(proof:OfflineProof)=>Promise<boolean>;
}){
  const [method,setMethod]=useState("fnb");
  const [busy,setBusy]=useState(false);

  if(member.status!=="pending") return null;
  const hasPayment=!!member.paymentStatus;
  const isFlagged=member.riskStatus!=="none";

  async function approve(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(busy)return;
    const form=new FormData(event.currentTarget);
    const details:OfflineProof={
      method:String(form.get("method")||""),
      methodDetail:String(form.get("methodDetail")||"").trim(),
      proofChannel:String(form.get("proofChannel")||""),
      reference:String(form.get("reference")||"").trim(),
      note:String(form.get("note")||"").trim()
    };
    if(!window.confirm("Confirm verified P200 offline payment for "+member.firstName+" "+member.lastName+" ("+member.id+")? This will record an approved payment and activate the membership."))return;
    setBusy(true);
    try{await onApprove(details)}finally{setBusy(false)}
  }

  return <section className="panel offline-pop-panel" aria-label="Offline payment approval">
    <p className="eyebrow">OFFLINE PAYMENT VERIFICATION</p>
    <h2>Approve offline POP · P200</h2>
    <p className="hint">For bank deposits, WhatsApp POP or payments verified outside the member portal. Check the actual payment evidence before approving.</p>
    {isFlagged?
      <p role="alert">This membership has an identity flag. Resolve the flag before approving an offline payment.</p>
    :hasPayment?
      <p className="hint">This member already has a <strong>{member.paymentStatus}</strong> payment record. Do not create another payment. <a href="/office">Review the existing payment in Club office</a>.</p>
    :<form onSubmit={approve}>
      <div className="form-grid">
        <label className="field">Bank / payment method
          <select name="method" value={method} onChange={event=>setMethod(event.target.value)} required disabled={busy}>
            <option value="fnb">FNB</option>
            <option value="stanbic">Stanbic Bank</option>
            <option value="other">Other (including cash)</option>
          </select>
        </label>
        {method==="other"&&<label className="field">Specify other payment method
          <input name="methodDetail" maxLength={120} minLength={2} required disabled={busy} placeholder="e.g. cash, another bank"/>
        </label>}
        <label className="field">Proof received through
          <select name="proofChannel" defaultValue="whatsapp" required disabled={busy}>
            <option value="whatsapp">WhatsApp POP</option>
            <option value="bank_statement">Bank statement</option>
            <option value="in_person">Physical receipt / in person</option>
            <option value="other">Other verified evidence</option>
          </select>
        </label>
        <label className="field">Transaction / receipt reference
          <input name="reference" minLength={3} maxLength={100} required disabled={busy} placeholder="Bank reference or issued receipt no."/>
        </label>
      </div>
      <label className="field">Verification note (optional)
        <textarea name="note" rows={2} maxLength={300} disabled={busy} placeholder="Additional information about verification"/>
      </label>
      <p className="hint">Confirmation will record one approved P200 payment, your administrator identity and review time, and activate this member until 31 July 2027.</p>
      <div className="form-actions">
        <button type="submit" className="primary" disabled={busy}>{busy?"Recording approval…":"Approve P200 & activate"}</button>
      </div>
    </form>}
  </section>;
}
