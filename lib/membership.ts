import { DB } from "./platform";
import { writeAudit } from "./audit";

export type MembershipSettings={
 membershipValidityDays:number;
 expiryReminderDays:number;
 seasonName:string;
 seasonStartDate:string;
 seasonEndDate:string;
 membershipFee:number;
 registrationOpen:boolean;
};

export async function getMembershipSettings():Promise<MembershipSettings>{
 const row=await DB.prepare("SELECT membership_validity_days AS membershipValidityDays,expiry_reminder_days AS expiryReminderDays,season_name AS seasonName,season_start_date AS seasonStartDate,season_end_date AS seasonEndDate,membership_fee AS membershipFee,registration_open AS registrationOpen FROM club_settings WHERE id=1").first() as Partial<MembershipSettings>|null;
 return {
  membershipValidityDays:Number(row?.membershipValidityDays||334),
  expiryReminderDays:Number(row?.expiryReminderDays||7),
  seasonName:String(row?.seasonName||"2026 / 2027"),
  seasonStartDate:String(row?.seasonStartDate||"2026-09-01"),
  seasonEndDate:String(row?.seasonEndDate||"2027-07-31"),
  membershipFee:Number(row?.membershipFee||200),
  registrationOpen:Boolean(row?.registrationOpen??true),
 };
}

export function calculateMembershipExpiry(settings:MembershipSettings,from=new Date()){
 const today=from.toISOString().slice(0,10);
 if(settings.seasonEndDate>=today)return settings.seasonEndDate;
 const fallback=new Date(from.getTime()+settings.membershipValidityDays*86400000);
 return fallback.toISOString().slice(0,10);
}

export async function expireDueMemberships(){
 const today=new Date().toISOString().slice(0,10);
 const due=await DB.prepare("SELECT id,status,expires_at AS expiresAt FROM members WHERE status='active' AND expires_at<>'' AND expires_at<?").bind(today).all() as {results:Array<{id:string;status:string;expiresAt:string}>};
 for(const member of due.results){
  await DB.prepare("UPDATE members SET status='expired' WHERE id=? AND status='active'").bind(member.id).run();
  await writeAudit({email:"system",name:"System",role:"automation"},"membership_expired","member",member.id,{status:"active",expiresAt:member.expiresAt},{status:"expired",expiresAt:member.expiresAt},"Automatic expiry");
 }
 return due.results.length;
}
