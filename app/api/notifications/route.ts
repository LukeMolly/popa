import { DB } from "../../../lib/platform";
import { getClubAdmin } from "../../admin-auth";
import { addNotificationMessage, createMemberNotification } from "../../../lib/member-notifications";
import { writeAudit } from "../../../lib/audit";

export const dynamic="force-dynamic";
const clean=(value:unknown,max=2000)=>typeof value==="string"?value.trim().slice(0,max):"";
const fail=(error:string,status=400)=>Response.json({error},{status});

async function membershipAdmin(){
 const admin=await getClubAdmin();
 return admin&&["executive","membership"].includes(admin.role)?admin:null;
}

export async function GET(){
 const admin=await membershipAdmin();
 if(!admin)return fail("Membership administrator access required.",403);
 try{
  const [threads,messages]=await Promise.all([
   DB.prepare("SELECT n.id,n.member_id AS memberId,m.first_name AS firstName,m.last_name AS lastName,m.email,n.title,n.body,n.category,n.created_by_role AS createdByRole,n.created_by_email AS createdByEmail,n.status,n.action_required AS actionRequired,n.member_read_at AS memberReadAt,n.admin_read_at AS adminReadAt,n.created_at AS createdAt,n.updated_at AS updatedAt,n.last_sender_role AS lastSenderRole FROM member_notifications n JOIN members m ON m.id=n.member_id ORDER BY COALESCE(NULLIF(n.updated_at,''),n.created_at) DESC LIMIT 250").all<any>(),
   DB.prepare("SELECT id,notification_id AS notificationId,sender_role AS senderRole,sender_email AS senderEmail,sender_name AS senderName,body,created_at AS createdAt FROM member_notification_messages ORDER BY created_at ASC").all<any>()
  ]);
  const now=new Date().toISOString();
  const result=threads.results.map(t=>({
   ...t,
   actionRequired:Boolean(t.actionRequired),
   unread:t.lastSenderRole==="member"&&(!t.adminReadAt||t.adminReadAt<t.updatedAt),
   messages:messages.results.filter(m=>Number(m.notificationId)===Number(t.id))
  }));
  await DB.prepare("UPDATE member_notifications SET admin_read_at=? WHERE last_sender_role='member'").bind(now).run();
  return Response.json({notifications:result},{headers:{"Cache-Control":"no-store"}});
 }catch(error){console.error("Admin notifications unavailable",error);return fail("Notification centre is unavailable.",500)}
}

export async function POST(request:Request){
 const admin=await membershipAdmin();
 if(!admin)return fail("Membership administrator access required.",403);
 try{
  const data=await request.json().catch(()=>null) as Record<string,unknown>|null;
  const action=clean(data?.action,30);

  if(action==="send"){
   const memberId=clean(data?.memberId,40),title=clean(data?.title,160),body=clean(data?.body,2000),category=clean(data?.category,40);
   const actionRequired=Boolean(data?.actionRequired);
   if(!memberId||title.length<3||body.length<3)return fail("Member, subject and message are required.");
   if(!["admin_request","general"].includes(category))return fail("Choose a valid notification type.");
   const member=await DB.prepare("SELECT id FROM members WHERE id=?").bind(memberId).first<{id:string}>();
   if(!member)return fail("Member not found.",404);
   const created=await createMemberNotification({
    memberId,title,body,category:category as "admin_request"|"general",createdByRole:"admin",createdByEmail:admin.email,actionRequired,status:"open"
   });
   if(!created?.id)return fail("Could not send notification.",500);
   await writeAudit(admin,"admin_notification_sent","notification",String(created.id),undefined,{memberId,title,category,actionRequired},"Membership office sent in-app notification");
   return Response.json({ok:true,id:created.id});
  }

  if(action==="reply"){
   const notificationId=Number(data?.notificationId),body=clean(data?.body,2000),actionRequired=Boolean(data?.actionRequired);
   if(!Number.isInteger(notificationId)||notificationId<1)return fail("Invalid conversation.");
   if(body.length<2)return fail("Enter a reply.");
   const thread=await DB.prepare("SELECT id,status FROM member_notifications WHERE id=?").bind(notificationId).first<{id:number;status:string}>();
   if(!thread)return fail("Conversation not found.",404);
   await addNotificationMessage({notificationId,senderRole:"admin",senderEmail:admin.email,senderName:admin.name,body,status:"answered",actionRequired});
   await writeAudit(admin,"admin_notification_replied","notification",String(notificationId),undefined,{actionRequired},"Membership office replied to member");
   return Response.json({ok:true});
  }

  if(action==="resolve"){
   const notificationId=Number(data?.notificationId);
   const result=await DB.prepare("UPDATE member_notifications SET status='resolved',action_required=0,updated_at=? WHERE id=?").bind(new Date().toISOString(),notificationId).run();
   if(!result.meta.changes)return fail("Conversation not found.",404);
   await writeAudit(admin,"notification_resolved","notification",String(notificationId),undefined,{status:"resolved"},"Conversation resolved");
   return Response.json({ok:true});
  }

  return fail("Unknown notification action.");
 }catch(error){console.error("Admin notification update failed",error);return fail("Could not update notification centre.",500)}
}
