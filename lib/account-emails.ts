import { appBaseUrl, button, emailShell, getMembershipAdminEmails, sendEmail } from "./email";

function esc(value:string){return value.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]||c))}
type MemberEmail={id:string;email:string;firstName:string;lastName:string};

export async function emailMemberPaymentDecision(member:MemberEmail,status:"approved"|"rejected",amount:number,expiresAt:string,note:string){
 const name=esc((member.firstName+" "+member.lastName).trim());
 if(status==="approved"){
  return sendEmail({
   to:member.email,template:"member_payment_approved",subject:"Membership activated — Township Rollers FC",
   text:"Your payment of P"+amount+" has been approved. Your membership is active until "+expiresAt+".",
   html:emailShell("Membership activated","<p>Hello <strong>"+name+"</strong>,</p><p>Your payment of <strong>P"+amount+"</strong> has been approved and your Township Rollers membership is now <strong>active</strong>.</p><p>Membership ID: <strong>"+esc(member.id)+"</strong><br>Expiry date: <strong>"+esc(expiresAt)+"</strong></p>"+button(appBaseUrl()+"/member-login","Open my membership"))
  });
 }
 return sendEmail({
  to:member.email,template:"member_payment_rejected",subject:"Payment review update — Township Rollers FC",
  text:"Your membership payment could not be approved."+(note?" Reason: "+note:"")+" Please sign in and submit a new proof of payment.",
  html:emailShell("Payment needs attention","<p>Hello <strong>"+name+"</strong>,</p><p>Your membership payment could not be approved.</p>"+(note?"<p>Reason: <strong>"+esc(note)+"</strong></p>":"")+"<p>Please sign in and upload a new proof of payment.</p>"+button(appBaseUrl()+"/member-login","Open member login"))
 });
}

export async function emailAdminsPaymentSubmitted(member:MemberEmail,amount:number,paymentId:string){
 const admins=await getMembershipAdminEmails();if(!admins.length)return {ok:false,skipped:true};
 const name=esc((member.firstName+" "+member.lastName).trim());
 return sendEmail({
  to:admins,template:"admin_payment_submitted",subject:"Payment submitted: "+member.id,
  text:member.firstName+" "+member.lastName+" submitted a payment of P"+amount+" for review.",
  html:emailShell("Payment submitted","<p><strong>"+name+"</strong> submitted a membership payment for review.</p><p>Membership ID: <strong>"+esc(member.id)+"</strong><br>Amount: <strong>P"+amount+"</strong><br>Payment record: "+esc(paymentId)+"</p>"+button(appBaseUrl()+"/office","Review payment"))
 });
}

export async function emailAdminsPasswordRecovery(member:MemberEmail){
 const admins=await getMembershipAdminEmails();if(!admins.length)return {ok:false,skipped:true};
 const name=esc((member.firstName+" "+member.lastName).trim());
 return sendEmail({
  to:admins,template:"admin_password_recovery",subject:"Password recovery request: "+member.id,
  text:member.firstName+" "+member.lastName+" requested password recovery.",
  html:emailShell("Password recovery request","<p><strong>"+name+"</strong> requested password recovery.</p><p>Membership ID: <strong>"+esc(member.id)+"</strong><br>Email: "+esc(member.email)+"</p>"+button(appBaseUrl()+"/admin","Open membership dashboard"))
 });
}

export async function emailMemberTemporaryCode(member:MemberEmail,code:string){
 const name=esc((member.firstName+" "+member.lastName).trim());
 return sendEmail({
  to:member.email,template:"member_password_reset_code",subject:"Your temporary Township Rollers access code",
  text:"Your temporary 4-character access code is "+code+". Sign in and change it immediately.",
  html:emailShell("Temporary access code","<p>Hello <strong>"+name+"</strong>,</p><p>Your temporary 4-character access code is:</p><div style=\"font-size:30px;font-weight:800;letter-spacing:6px;background:#f5f7fb;padding:16px 20px;border-radius:10px;text-align:center\">"+esc(code)+"</div><p>Use it once to sign in. You will be required to create a new password immediately.</p>"+button(appBaseUrl()+"/member-login","Sign in now")+"<p>If you did not request password recovery, contact the membership office.</p>")
 });
}

export async function emailMemberStatusChange(member:MemberEmail,status:string,expiresAt:string){
 const name=esc((member.firstName+" "+member.lastName).trim());
 return sendEmail({
  to:member.email,template:"member_status_changed",subject:"Membership status update — Township Rollers FC",
  text:"Your membership status is now "+status+(expiresAt?". Expiry: "+expiresAt:"")+".",
  html:emailShell("Membership status updated","<p>Hello <strong>"+name+"</strong>,</p><p>Your membership status is now <strong>"+esc(status.toUpperCase())+"</strong>.</p>"+(expiresAt?"<p>Expiry date: <strong>"+esc(expiresAt)+"</strong></p>":"")+button(appBaseUrl()+"/member-login","View my membership"))
 });
}

export async function emailMemberExpired(member:MemberEmail,expiresAt:string){
 const name=esc((member.firstName+" "+member.lastName).trim());
 return sendEmail({
  to:member.email,template:"member_membership_expired",subject:"Your Township Rollers membership has expired",
  text:"Your membership expired on "+expiresAt+". Sign in to submit renewal payment.",
  html:emailShell("Membership expired","<p>Hello <strong>"+name+"</strong>,</p><p>Your Township Rollers membership expired on <strong>"+esc(expiresAt)+"</strong>.</p><p>You can renew by signing in and submitting proof of payment.</p>"+button(appBaseUrl()+"/member-login","Renew membership"))
 });
}
