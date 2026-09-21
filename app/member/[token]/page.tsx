import { DB } from "../../../lib/platform";
const env = { DB };
import { notFound, redirect } from "next/navigation";
import { requireChatGPTUser } from "../../chatgpt-auth";
import { isClubAdmin } from "../../admin-auth";
import MemberPortal from "./member-portal-client";

export const dynamic="force-dynamic";
export default async function ProtectedMemberPage({params}:{params:Promise<{token:string}>}){
 const {token}=await params,user=await requireChatGPTUser(`/member/${token}`);
 const member=await env.DB.prepare("SELECT email FROM members WHERE token=?").bind(token).first() as {email:string}|null;
 if(!member) notFound();
 if(member.email.toLowerCase()!==user.email.toLowerCase()&&!(await isClubAdmin(["executive","membership"]))) redirect("/account");
 return <MemberPortal params={Promise.resolve({token})}/>;
}
