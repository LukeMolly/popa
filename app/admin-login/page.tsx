import { redirect } from "next/navigation";
import { getClubAdmin } from "../admin-auth";
import AdminLoginClient from "./admin-login-client";
export const dynamic="force-dynamic";
export default async function AdminLoginPage({searchParams}:{searchParams:Promise<{return_to?:string}>}){
 const admin=await getClubAdmin(),params=await searchParams,returnTo=["/office","/admin","/admin-access"].includes(params.return_to||"")?params.return_to!:"/office";
 if(admin)redirect(returnTo);
 return <AdminLoginClient returnTo={returnTo}/>;
}
