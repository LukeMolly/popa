import { DB } from "../../../../../lib/platform";
import { getChatGPTUser } from "../../../../chatgpt-auth";
import { isClubAdmin } from "../../../../admin-auth";
import { addNotificationMessage, createMemberNotification } from "../../../../../lib/member-notifications";
import { writeAudit } from "../../../../../lib/audit";

export const dynamic="force-dynamic";
type Context={params:Promise<{token:string}>};
const fail=(error:string,status=400)=>Response.json({error},{status});
const clean=(value:unknown,max=2000)=>typeof value==="string"?value.trim().slice(0,max):"";

async function authorisedMember(token:string){
 const user=await getChatGPTUser();
 if(!user)return null;
 const member=await DB.prepare("SELECT id,email,first_name AS firstName,last_name AS lastName FROM members WHERE token=?").bind(token).first<{id:string;email:string;firstName:string;lastName:string}>();
 if(!member)return null;
 if(member.email.toLowerCase()!==user.email.toLowerCase()&&!(await isClubAdmin(["executive","membership"])))return null;
 return member;
}

export async function GET(_request:Request,{params}:Context){
 try{
  const {token}=await params,member=await authorisedMember(token);
  if(!member)return fail("Member sign-in required.",403);
  const [threads,messages]=await Promise.all([
   DB.prepare("SELECT id,title,body,category,created_by_role AS createdByRole,created_by_email AS createdByEmail,status,action_required AS actionRequired,member_read_at AS memberReadAt,admin_read_at AS adminReadAt,created_at AS createdAt,updated_at AS updatedAt,last_sender_role AS lastSenderRole FROM member_notifications WHERE member_id=? ORDER BY COALESCE(NULLIF(updated_at,''),created_at) DESC LIMIT 100").bind(member.id).all<any>(),
   DB.prepare("SELECT msg.id,msg.notification_id AS notificationId,msg.sender_role AS senderRole,msg.sender_email AS senderEmail,msg.sender_name AS senderName,msg.body,msg.created_at AS createdAt FROM member_notification_messages msg JOIN member_notifications n ON n.id=msg.notification_id WHERE n.member_id=? ORDER BY msg.created_at ASC").bind(member.id).all<any>()
  ]);
  const now=new Date().toISOString();
  const result=threads.results.map(t=>({
   ...t,
   actionRequired:Boolean(t.actionRequired),
   unread:t.lastSenderRole!=="member"&&(!t.memberReadAt||t.memberReadAt<t.updatedAt),
   messages:messages.results.filter(m=>Number(m.notificationId)===Number(t.id))
  }));
  await DB.prepare("UPDATE member_notifications SET member_read_at=? WHERE member_id=? AND last_sender_role<>'member'").bind(now,member.id).run();
  return Response.json({notifications:result},{headers:{"Cache-Control":"no-store"}});
 }catch(error){console.error("Member notifications unavailable",error);return fail("Notifications are unavailable right now.",500)}
}

export async function POST(request:Request,{params}:Context){
 try{
  const {token}=await params,member=await authorisedMember(token);
  if(!member)return fail("Member sign-in required.",403);
  const data=await request.json().catch(()=>null) as Record<string,unknown>|null;
  const action=clean(data?.action,30);

  if(action==="query"){
   const title=clean(data?.title,160),body=clean(data?.body,2000);
   if(title.length<3)return fail("Enter a short subject for your query.");
   if(body.length<5)return fail("Enter your query or message.");
   const created=await createMemberNotification({
    memberId:member.id,title,body,category:"query",createdByRole:"member",createdByEmail:member.email,actionRequired:false,status:"open"
   });
   if(!created?.id)return fail("Could not create your query.",500);
   await writeAudit({email:member.email,name:member.firstName+" "+member.lastName,role:"member"},"member_query_created","notification",String(created.id),undefined,{title},"Member submitted an in-app query");
   return Response.json({ok:true,id:created.id});
  }

  if(action==="reply"){
   const notificationId=Number(data?.notificationId),body=clean(data?.body,2000);
   if(!Number.isInteger(notificationId)||notificationId<1)return fail("Invalid conversation.");
   if(body.length<2)return fail("Enter a reply.");
   const thread=await DB.prepare("SELECT id,status FROM member_notifications WHERE id=? AND member_id=?").bind(notificationId,member.id).first<{id:number;status:string}>();
   if(!thread)return fail("Conversation not found.",404);
   if(thread.status==="resolved")return fail("This conversation has been resolved.",409);
   await addNotificationMessage({notificationId,senderRole:"member",senderEmail:member.email,senderName:member.firstName+" "+member.lastName,body,status:"open",actionRequired:false});
   await writeAudit({email:member.email,name:member.firstName+" "+member.lastName,role:"member"},"member_notification_replied","notification",String(notificationId),undefined,{reply:true},"Member replied to membership office");
   return Response.json({ok:true});
  }

  if(action==="resolve"){
   const notificationId=Number(data?.notificationId);
   const result=await DB.prepare("UPDATE member_notifications SET status='resolved',action_required=0,updated_at=? WHERE id=? AND member_id=?").bind(new Date().toISOString(),notificationId,member.id).run();
   if(!result.meta.changes)return fail("Conversation not found.",404);
   return Response.json({ok:true});
  }

  return fail("Unknown notification action.");
 }catch(error){console.error("Member notification update failed",error);return fail("Could not update notifications.",500)}
}
