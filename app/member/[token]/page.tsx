import { DB } from "../../../lib/platform";
import { notFound, redirect } from "next/navigation";
import { getMemberSession } from "../../../lib/member-auth";
import MemberPortal from "./member-portal-client";

export const dynamic="force-dynamic";
export default async function ProtectedMemberPage({params}:{params:Promise<{token:string}>}){
 const {token}=await params,session=await getMemberSession();
 if(!session)redirect("/member-login");
 if(session.passwordMustChange)redirect("/change-password");
 const member=await DB.prepare("SELECT id FROM members WHERE token=?").bind(token).first<{id:string}>();
 if(!member)notFound();
 if(member.id!==session.id)redirect("/account");
 return <MemberPortal params={Promise.resolve({token})}/>;
}
