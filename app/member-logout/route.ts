import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DB } from "../../lib/platform";
import { MEMBER_SESSION_COOKIE, sessionTokenHash } from "../../lib/member-auth";
export async function GET(){const store=await cookies(),token=store.get(MEMBER_SESSION_COOKIE)?.value;if(token)await DB.prepare("DELETE FROM member_sessions WHERE token_hash=?").bind(sessionTokenHash(token)).run();store.set(MEMBER_SESSION_COOKIE,"",{httpOnly:true,secure:true,sameSite:"lax",path:"/",maxAge:0});redirect("/member-login")}
