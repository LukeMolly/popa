import { env } from "cloudflare:workers";
import { redirect } from "next/navigation";
import { requireChatGPTUser, chatGPTSignOutPath } from "../chatgpt-auth";

export const dynamic="force-dynamic";
export default async function AccountPage(){
 const user=await requireChatGPTUser("/account");
 const record=await env.DB.prepare("SELECT token FROM members WHERE lower(email)=lower(?) ORDER BY created_at DESC LIMIT 1").bind(user.email).first() as {token:string}|null;
 if(record?.token) redirect(`/member/${record.token}`);
 return <main className="account-empty"><div className="account-empty-card"><span className="mini-crest">TR</span><p className="eyebrow">MEMBER ACCOUNT</p><h1>No membership is linked yet</h1><p>You are signed in as <strong>{user.email}</strong>. Register using the same email address and your membership will appear here after submission.</p><div><a className="primary" href="/register">Complete membership registration</a><a className="secondary" href={chatGPTSignOutPath("/")}>Use another account</a></div></div></main>;
}
