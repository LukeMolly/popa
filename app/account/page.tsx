import { DB } from "../../lib/platform";
import { redirect } from "next/navigation";
import { getMemberSession } from "../../lib/member-auth";

export const dynamic="force-dynamic";
export default async function AccountPage(){
 const memberSession=await getMemberSession();
 if(!memberSession)redirect("/member-login");
 if(memberSession.passwordMustChange)redirect("/change-password");
 const record=await DB.prepare("SELECT token FROM members WHERE id=? LIMIT 1").bind(memberSession.id).first<{token:string}>();
 if(record?.token)redirect(`/member/${record.token}`);
 return <main className="account-empty"><div className="account-empty-card"><span className="mini-crest">TR</span><p className="eyebrow">MEMBER ACCOUNT</p><h1>Membership record unavailable</h1><p>Your member login is valid, but no membership record could be opened. Please contact the membership office.</p><div><a className="secondary" href="/member-logout">Sign out</a></div></div></main>;
}
