import { DB } from "./platform";

export type NotificationCategory="query"|"membership_status"|"admin_request"|"payment"|"general";
export type NotificationRole="member"|"admin"|"system";

export async function createMemberNotification(input:{
 memberId:string;
 title:string;
 body:string;
 category:NotificationCategory;
 createdByRole:NotificationRole;
 createdByEmail?:string;
 actionRequired?:boolean;
 status?:"open"|"answered"|"resolved";
}){
 const now=new Date().toISOString();
 return DB.prepare("INSERT INTO member_notifications (member_id,title,body,created_at,category,created_by_role,created_by_email,status,action_required,member_read_at,admin_read_at,updated_at,last_sender_role) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING id")
  .bind(
   input.memberId,
   input.title.trim().slice(0,160),
   input.body.trim().slice(0,2000),
   now,
   input.category,
   input.createdByRole,
   (input.createdByEmail||"").trim().toLowerCase().slice(0,160),
   input.status||"open",
   input.actionRequired?1:0,
   input.createdByRole==="member"?now:"",
   input.createdByRole==="admin"||input.createdByRole==="system"?now:"",
   now,
   input.createdByRole
  ).first<{id:number}>();
}

export async function addNotificationMessage(input:{
 notificationId:number;
 senderRole:NotificationRole;
 senderEmail?:string;
 senderName?:string;
 body:string;
 status?:"open"|"answered"|"resolved";
 actionRequired?:boolean;
}){
 const now=new Date().toISOString();
 await DB.batch([
  DB.prepare("INSERT INTO member_notification_messages (id,notification_id,sender_role,sender_email,sender_name,body,created_at) VALUES (?,?,?,?,?,?,?)")
   .bind(crypto.randomUUID(),input.notificationId,input.senderRole,(input.senderEmail||"").trim().toLowerCase().slice(0,160),(input.senderName||"").trim().slice(0,160),input.body.trim().slice(0,2000),now),
  DB.prepare("UPDATE member_notifications SET status=?,action_required=?,updated_at=?,last_sender_role=?,member_read_at=CASE WHEN ?='member' THEN ? ELSE member_read_at END,admin_read_at=CASE WHEN ? IN ('admin','system') THEN ? ELSE admin_read_at END WHERE id=?")
   .bind(input.status||"open",input.actionRequired?1:0,now,input.senderRole,input.senderRole,now,input.senderRole,now,input.notificationId)
 ]);
}

export async function notifyMembershipStatus(memberId:string,status:string,expiresAt=""){
 const statusLabel=status.charAt(0).toUpperCase()+status.slice(1);
 const body=status==="active"
  ? "Your Township Rollers membership is now active"+(expiresAt?" until "+expiresAt:"")+"."
  : status==="suspended"
   ? "Your Township Rollers membership has been suspended. Please contact the membership office if you need clarification."
   : status==="expired"
    ? "Your Township Rollers membership has expired"+(expiresAt?" as of "+expiresAt:"")+". Please submit renewal payment to reactivate it."
    : "Your Township Rollers membership status is now "+statusLabel+".";
 return createMemberNotification({
  memberId,
  title:"Membership status: "+statusLabel,
  body,
  category:"membership_status",
  createdByRole:"system",
  actionRequired:status==="suspended"||status==="expired",
  status:"open"
 });
}

export async function notifyPaymentDecision(memberId:string,status:"approved"|"rejected",note="",expiresAt=""){
 return createMemberNotification({
  memberId,
  title:status==="approved"?"Payment approved":"Payment requires attention",
  body:status==="approved"
   ? "Your payment has been approved and your membership is active"+(expiresAt?" until "+expiresAt:"")+"."
   : "Your payment could not be approved."+(note?" Reason: "+note:"")+" Please submit a new proof of payment or contact the membership office.",
  category:"payment",
  createdByRole:"system",
  actionRequired:status==="rejected",
  status:"open"
 });
}
