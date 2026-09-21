import { env } from "cloudflare:workers";
import { getClubAdmin } from "../../admin-auth";
export const dynamic="force-dynamic";
const clean=(v:unknown,n=200)=>typeof v==="string"?v.trim().slice(0,n):"";
const error=(message:string,status=400)=>Response.json({error:message},{status});
export async function GET(){
 const admin=await getClubAdmin();
 if(!admin)return error("Administrator access required.",403);
 try{
  const [payments,fixtures,standings,settings,players]=await Promise.all([
   env.DB.prepare("SELECT p.id,p.member_id AS memberId,m.first_name AS firstName,m.last_name AS lastName,p.amount,p.reference,p.receipt_name AS receiptName,p.status,p.note,p.created_at AS createdAt,p.reviewed_at AS reviewedAt FROM payments p JOIN members m ON m.id=p.member_id ORDER BY p.created_at DESC").all(),
   env.DB.prepare("SELECT id,opponent,kickoff,venue,home_away AS homeAway,competition,status,rollers_score AS rollersScore,opponent_score AS opponentScore FROM fixtures ORDER BY kickoff DESC").all(),
   env.DB.prepare("SELECT team,played,won,drawn,lost,goal_difference AS goalDifference,points,updated_at AS updatedAt FROM standings ORDER BY points DESC,goal_difference DESC").all(),
   env.DB.prepare("SELECT membership_validity_days AS membershipValidityDays,expiry_reminder_days AS expiryReminderDays FROM club_settings WHERE id=1").first(),
   env.DB.prepare("SELECT id,first_name AS firstName,last_name AS lastName,squad_number AS squadNumber,position,contract_type AS contractType,contract_start AS contractStart,contract_end AS contractEnd,status,lineup_role AS lineupRole FROM players ORDER BY squad_number ASC").all()
  ]);
  const full=admin.role==="executive";
  return Response.json({role:admin.role,adminName:admin.name,payments:full||admin.role==="membership"?payments.results:[],fixtures:full||admin.role==="operations"?fixtures.results:[],standings:full||admin.role==="operations"?standings.results:[],settings:full||admin.role==="membership"?(settings||{membershipValidityDays:30,expiryReminderDays:7}):{membershipValidityDays:0,expiryReminderDays:0},players:full||admin.role==="coach"?players.results:[]});
 }catch(e){console.error(e);return error("Club office data unavailable.",500)}
}
export async function POST(request:Request){
 const admin=await getClubAdmin();
 if(!admin)return error("Administrator access required.",403);
 try{
  const v=await request.json() as Record<string,unknown>,db=env.DB,now=new Date().toISOString();
  const action=clean(v.action,40);
  const allowed:Record<string,string[]>={membership:["review","expiry-settings"],operations:["fixture","fixture-update","result","standing","standing-delete","update"],coach:["player","player-delete"],executive:["review","expiry-settings","fixture","fixture-update","result","standing","standing-delete","update","player","player-delete"]};
  if(!allowed[admin.role]?.includes(action))return error("Your administrator role cannot perform this action.",403);
  if(v.action==="review"){
   const id=clean(v.id,60),status=clean(v.status,20),note=clean(v.note,300);
   if(!["approved","rejected"].includes(status))return error("Choose approve or reject.");
   const payment=await db.prepare("SELECT member_id AS memberId,status FROM payments WHERE id=?").bind(id).first() as {memberId:string;status:string}|null;
   if(!payment||payment.status!=="submitted")return error("Payment is no longer awaiting review.",409);
   const statements=[db.prepare("UPDATE payments SET status=?,note=?,reviewed_at=? WHERE id=? AND status='submitted'").bind(status,note,now,id)];
   if(status==="approved"){
    const expiresAt="2027-07-31";
    statements.push(db.prepare("UPDATE members SET status='active',expires_at=? WHERE id=?").bind(expiresAt,payment.memberId));
   }
   await db.batch(statements);
   return Response.json({ok:true});
  }
  if(v.action==="fixture"){
   const opponent=clean(v.opponent,100),kickoff=clean(v.kickoff,40),venue=clean(v.venue,120),homeAway=clean(v.homeAway,10),competition=clean(v.competition,100);
   if(!opponent||!kickoff||!venue||!["home","away"].includes(homeAway)||Number.isNaN(Date.parse(kickoff)))return error("Complete the opponent, date, venue and home or away fields.");
   const id=crypto.randomUUID();
   await db.prepare("INSERT INTO fixtures (id,opponent,kickoff,venue,home_away,competition,status,created_at) VALUES (?,?,?,?,?,?,'upcoming',?)").bind(id,opponent,kickoff,venue,homeAway,competition,now).run();
   return Response.json({id});
  }
  if(v.action==="fixture-update"){
   const id=clean(v.id,60),opponent=clean(v.opponent,100),kickoff=clean(v.kickoff,40),venue=clean(v.venue,120),homeAway=clean(v.homeAway,10),competition=clean(v.competition,100);
   if(!id||!opponent||!kickoff||!venue||!["home","away"].includes(homeAway)||Number.isNaN(Date.parse(kickoff)))return error("Complete the opponent, date, venue and home or away fields.");
   const result=await db.prepare("UPDATE fixtures SET opponent=?,kickoff=?,venue=?,home_away=?,competition=? WHERE id=?").bind(opponent,kickoff,venue,homeAway,competition,id).run();
   return result.meta.changes?Response.json({ok:true}):error("Fixture not found.",404);
  }
  if(v.action==="result"){
   const id=clean(v.id,60),rollersScore=Number(v.rollersScore),opponentScore=Number(v.opponentScore);
   if(!Number.isInteger(rollersScore)||!Number.isInteger(opponentScore)||rollersScore<0||opponentScore<0||rollersScore>99||opponentScore>99)return error("Enter valid scores.");
   const result=await db.prepare("UPDATE fixtures SET status='completed',rollers_score=?,opponent_score=? WHERE id=?").bind(rollersScore,opponentScore,id).run();
   return result.meta.changes?Response.json({ok:true}):error("Fixture not found.",404);
  }
  if(v.action==="standing"){
   const team=clean(v.team,100),originalTeam=clean(v.originalTeam,100),nums=["played","won","drawn","lost","goalDifference","points"].map(k=>Number(v[k]));
   if(!team||nums.some(n=>!Number.isInteger(n))||nums.some((n,i)=>i!==4&&n<0))return error("Enter a team and valid league figures.");
   const [played,won,drawn,lost,gd,points]=nums;
   if(played!==won+drawn+lost)return error("Played must equal wins, draws and losses.");
   if(originalTeam&&originalTeam!==team){
    const existing=await db.prepare("SELECT team FROM standings WHERE team=?").bind(team).first();
    if(existing)return error("A team with that name already exists.",409);
    const renamed=await db.prepare("UPDATE standings SET team=?,played=?,won=?,drawn=?,lost=?,goal_difference=?,points=?,updated_at=? WHERE team=?").bind(team,played,won,drawn,lost,gd,points,now,originalTeam).run();
    if(!renamed.meta.changes)return error("Team not found.",404);
   }else await db.prepare("INSERT INTO standings (team,played,won,drawn,lost,goal_difference,points,updated_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(team) DO UPDATE SET played=excluded.played,won=excluded.won,drawn=excluded.drawn,lost=excluded.lost,goal_difference=excluded.goal_difference,points=excluded.points,updated_at=excluded.updated_at").bind(team,played,won,drawn,lost,gd,points,now).run();
   return Response.json({ok:true});
  }
  if(v.action==="standing-delete"){
   const team=clean(v.team,100);
   if(!team)return error("Choose a team to delete.");
   const result=await db.prepare("DELETE FROM standings WHERE team=?").bind(team).run();
   return result.meta.changes?Response.json({ok:true}):error("Team not found.",404);
  }
  if(v.action==="update"){
   const title=clean(v.title,150),body=clean(v.body,3000);
   if(!title||!body)return error("Title and message are required.");
   await db.prepare("INSERT INTO club_updates (title,body,created_at) VALUES (?,?,?)").bind(title,body,now).run();
   return Response.json({ok:true});
  }
  if(v.action==="expiry-settings"){
   const validityDays=Number(v.membershipValidityDays),reminderDays=Number(v.expiryReminderDays);
   if(!Number.isInteger(validityDays)||validityDays<1||validityDays>3650)return error("Membership validity must be between 1 and 3650 days.");
   if(!Number.isInteger(reminderDays)||reminderDays<0||reminderDays>validityDays)return error("Reminder days must be between 0 and the membership validity period.");
   await db.prepare("INSERT INTO club_settings (id,membership_validity_days,expiry_reminder_days,updated_at) VALUES (1,?,?,?) ON CONFLICT(id) DO UPDATE SET membership_validity_days=excluded.membership_validity_days,expiry_reminder_days=excluded.expiry_reminder_days,updated_at=excluded.updated_at").bind(validityDays,reminderDays,now).run();
   return Response.json({ok:true});
  }
  if(v.action==="player"){
   const id=clean(v.id,60)||crypto.randomUUID(),firstName=clean(v.firstName,80),lastName=clean(v.lastName,80),position=clean(v.position,40),contractType=clean(v.contractType,40),contractStart=clean(v.contractStart,10),contractEnd=clean(v.contractEnd,10),status=clean(v.status,20),lineupRole=clean(v.lineupRole,20),squadNumber=Number(v.squadNumber);
   if(!firstName||!lastName||!position||!Number.isInteger(squadNumber)||squadNumber<1||squadNumber>99)return error("Enter the player's name, position and a squad number from 1 to 99.");
   if(!["active","injured","loaned","released"].includes(status))return error("Choose a valid player status.");
   if(!["first_eleven","substitute","sub_out","sub_in","squad"].includes(lineupRole))return error("Choose a valid match role.");
   if(contractStart&&Number.isNaN(Date.parse(contractStart+"T00:00:00Z")))return error("Choose a valid contract start date.");
   if(contractEnd&&Number.isNaN(Date.parse(contractEnd+"T00:00:00Z")))return error("Choose a valid contract end date.");
   if(contractStart&&contractEnd&&contractEnd<contractStart)return error("Contract end date cannot be before the start date.");
   if(lineupRole==="first_eleven"||lineupRole==="sub_out"){
    const count=await db.prepare("SELECT COUNT(*) AS total FROM players WHERE lineup_role IN ('first_eleven','sub_out') AND id!=?").bind(id).first() as {total:number}|null;
    if(Number(count?.total||0)>=11)return error("The starting eleven is full. Move another player before adding this one.",409);
   }
   try{
    await db.prepare("INSERT INTO players (id,first_name,last_name,squad_number,position,contract_type,contract_start,contract_end,status,lineup_role,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET first_name=excluded.first_name,last_name=excluded.last_name,squad_number=excluded.squad_number,position=excluded.position,contract_type=excluded.contract_type,contract_start=excluded.contract_start,contract_end=excluded.contract_end,status=excluded.status,lineup_role=excluded.lineup_role,updated_at=excluded.updated_at").bind(id,firstName,lastName,squadNumber,position,contractType||"Permanent",contractStart,contractEnd,status,lineupRole,now,now).run();
   }catch(e){if(String(e).toLowerCase().includes("unique"))return error("That squad number is already assigned.",409);throw e}
   return Response.json({ok:true,id});
  }
  if(v.action==="player-delete"){
   const id=clean(v.id,60);if(!id)return error("Choose a player to delete.");
   const result=await db.prepare("DELETE FROM players WHERE id=?").bind(id).run();
   return result.meta.changes?Response.json({ok:true}):error("Player not found.",404);
  }
  return error("Unknown action.");
 }catch(e){console.error(e);return error("Could not save. Please try again.",500)}
}
