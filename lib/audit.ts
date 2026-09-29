import { DB } from "./platform";
type ScopedDB={prepare(query:string):any};
import type { ClubAdmin } from "../app/admin-auth";

export async function writeAudit(
  actor: ClubAdmin | {email?:string;name?:string;role?:string} | null,
  action: string,
  entityType: string,
  entityId: string,
  beforeValue?: unknown,
  afterValue?: unknown,
  note = "",
  db:ScopedDB=DB
) {
  const now=new Date().toISOString();
  await db.prepare("INSERT INTO audit_logs (id,actor_email,actor_name,actor_role,action,entity_type,entity_id,before_json,after_json,note,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
   .bind(
    crypto.randomUUID(),
    actor?.email||"",
    actor?.name||"",
    actor?.role||"",
    action,
    entityType,
    entityId,
    beforeValue===undefined?"":JSON.stringify(beforeValue),
    afterValue===undefined?"":JSON.stringify(afterValue),
    note.slice(0,500),
    now
   ).run();
}
