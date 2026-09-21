import { env } from "cloudflare:workers";
import { officialMatch } from "../../official-match";
export const dynamic="force-dynamic";
export async function GET(){
 try{
  const [fixtures,results,table,updates,players]=await Promise.all([
   env.DB.prepare("SELECT id,opponent,kickoff,venue,home_away AS homeAway,competition FROM fixtures WHERE status='upcoming' ORDER BY kickoff ASC LIMIT 30").all(),
   env.DB.prepare("SELECT id,opponent,kickoff,venue,home_away AS homeAway,competition,rollers_score AS rollersScore,opponent_score AS opponentScore FROM fixtures WHERE status='completed' ORDER BY kickoff DESC LIMIT 30").all(),
   env.DB.prepare("SELECT team,played,won,drawn,lost,goal_difference AS goalDifference,points,updated_at AS updatedAt FROM standings ORDER BY points DESC,goal_difference DESC,team ASC").all(),
   env.DB.prepare("SELECT id,title,body,created_at AS createdAt FROM club_updates ORDER BY created_at DESC LIMIT 30").all(),
   env.DB.prepare("SELECT id,first_name AS firstName,last_name AS lastName,squad_number AS squadNumber,position,contract_end AS contractEnd,status,lineup_role AS lineupRole FROM players WHERE status!='released' ORDER BY CASE lineup_role WHEN 'first_eleven' THEN 1 WHEN 'sub_out' THEN 1 WHEN 'substitute' THEN 2 WHEN 'sub_in' THEN 2 ELSE 3 END,squad_number ASC").all(),
  ]);
  return Response.json({fixtures:fixtures.results,results:results.results,standings:table.results,updates:updates.results,players:players.results,officialMatch},{headers:{"Cache-Control":"no-store"}});
 }catch(e){console.error(e);return Response.json({error:"Club information is temporarily unavailable."},{status:500})}
}
