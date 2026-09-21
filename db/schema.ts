import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
export const members = sqliteTable("members", {
  id: text("id").primaryKey(), firstName: text("first_name").notNull(), lastName: text("last_name").notNull(),
  phone: text("phone").notNull().default(""), email: text("email").notNull().default(""),
  status: text("status").notNull().default("pending"), expiresAt: text("expires_at").notNull().default(""),
  token: text("token").notNull(), createdAt: text("created_at").notNull(),
  idNumber: text("id_number").unique(), dateOfBirth: text("date_of_birth"), placeOfBirth: text("place_of_birth"),
  membershipLocation: text("membership_location"), gender: text("gender"),
}, (t) => [uniqueIndex("idx_members_token").on(t.token)]);
export const promos = sqliteTable("promos", {
  code: text("code").primaryKey(), campaign: text("campaign").notNull(), memberId: text("member_id"),
  status: text("status").notNull().default("available"), createdAt: text("created_at").notNull(),
});
export const updates = sqliteTable("updates", {
  id: integer("id").primaryKey({ autoIncrement: true }), title: text("title").notNull(),
  body: text("body").notNull(), createdAt: text("created_at").notNull(),
});
export const payments = sqliteTable("payments", {
  id: text("id").primaryKey(), memberId: text("member_id").notNull(),
  amount: integer("amount").notNull().default(200), receiptKey: text("receipt_key").notNull(),
  receiptName: text("receipt_name").notNull(), receiptType: text("receipt_type").notNull(),
  reference: text("reference").notNull().default(""), status: text("status").notNull().default("submitted"),
  note: text("note").notNull().default(""), createdAt: text("created_at").notNull(),
  reviewedAt: text("reviewed_at").notNull().default(""),
});
export const fixtures = sqliteTable("fixtures", {
  id: text("id").primaryKey(), opponent: text("opponent").notNull(),
  kickoff: text("kickoff").notNull(), venue: text("venue").notNull(),
  homeAway: text("home_away").notNull(), competition: text("competition").notNull().default(""),
  status: text("status").notNull().default("upcoming"),
  rollersScore: integer("rollers_score"), opponentScore: integer("opponent_score"),
  createdAt: text("created_at").notNull(),
});
export const standings = sqliteTable("standings", {
  id: integer("id").primaryKey({ autoIncrement: true }), team: text("team").notNull().unique(),
  played: integer("played").notNull().default(0), won: integer("won").notNull().default(0),
  drawn: integer("drawn").notNull().default(0), lost: integer("lost").notNull().default(0),
  goalDifference: integer("goal_difference").notNull().default(0), points: integer("points").notNull().default(0),
  updatedAt: text("updated_at").notNull(),
});
export const clubUpdates = sqliteTable("club_updates", {
  id: integer("id").primaryKey({ autoIncrement: true }), title: text("title").notNull(),
  body: text("body").notNull(), createdAt: text("created_at").notNull(),
});
export const memberNotifications = sqliteTable("member_notifications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  memberId: text("member_id").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  reply: text("reply").notNull().default(""),
  repliedAt: text("replied_at").notNull().default(""),
  createdAt: text("created_at").notNull(),
});
export const players = sqliteTable("players", {
  id: text("id").primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  squadNumber: integer("squad_number").notNull(),
  position: text("position").notNull(),
  contractType: text("contract_type").notNull().default("Permanent"),
  contractStart: text("contract_start").notNull().default(""),
  contractEnd: text("contract_end").notNull().default(""),
  status: text("status").notNull().default("active"),
  lineupRole: text("lineup_role").notNull().default("squad"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (t) => [uniqueIndex("idx_players_squad_number").on(t.squadNumber)]);
export const clubSettings = sqliteTable("club_settings", {
  id: integer("id").primaryKey(),
  membershipValidityDays: integer("membership_validity_days").notNull().default(30),
  expiryReminderDays: integer("expiry_reminder_days").notNull().default(7),
  updatedAt: text("updated_at").notNull(),
});
export const adminUsers = sqliteTable("admin_users", {
  email: text("email").primaryKey(),
  name: text("name").notNull().default(""),
  role: text("role").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  pinSalt: text("pin_salt").notNull().default(""),
  pinHash: text("pin_hash").notNull().default(""),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
export const adminSessions = sqliteTable("admin_sessions", {
  tokenHash: text("token_hash").primaryKey(),
  email: text("email").notNull(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
}, (t) => [uniqueIndex("idx_admin_sessions_token").on(t.tokenHash)]);
export const adminLoginAttempts = sqliteTable("admin_login_attempts", {
  email: text("email").primaryKey(),
  failedCount: integer("failed_count").notNull().default(0),
  lockedUntil: text("locked_until").notNull().default(""),
  updatedAt: text("updated_at").notNull(),
});
