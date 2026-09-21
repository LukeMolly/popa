"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
type Payment = {
  id: string;
  memberId: string;
  firstName: string;
  lastName: string;
  amount: number;
  reference: string;
  receiptName: string;
  status: string;
  note: string;
  createdAt: string;
};
type Fixture = {
  id: string;
  opponent: string;
  kickoff: string;
  venue: string;
  homeAway: string;
  competition: string;
  status: string;
  rollersScore: number | null;
  opponentScore: number | null;
};
type Standing = {
  team: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalDifference: number;
  points: number;
};
type ExpirySettings = {
  membershipValidityDays: number;
  expiryReminderDays: number;
};
type Player = {
  id: string;
  firstName: string;
  lastName: string;
  squadNumber: number;
  position: string;
  contractType: string;
  contractStart: string;
  contractEnd: string;
  status: string;
  lineupRole: string;
};
type Office = {
  payments: Payment[];
  fixtures: Fixture[];
  standings: Standing[];
  settings: ExpirySettings;
  players: Player[];
};
type AdminRole = "executive" | "membership" | "operations" | "coach";
const roleLabels: Record<AdminRole, string> = {executive:"Executive Access Administrator",membership:"Membership Administrator",operations:"Operations Administrator",coach:"Coach Administrator"};
export default function Office({role,name}:{role:AdminRole;name:string}) {
  const [data, setData] = useState<Office>({
      payments: [],
      fixtures: [],
      standings: [],
      settings: { membershipValidityDays: 30, expiryReminderDays: 7 },
      players: [],
    }),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [editingFixture, setEditingFixture] = useState<string | null>(null),
    [editingStanding, setEditingStanding] = useState<Standing | null>(null),
    [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const canMembership=role==="executive"||role==="membership",canOperations=role==="executive"||role==="operations",canCoach=role==="executive"||role==="coach";
  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/staff", { cache: "no-store" });
      const d = (await r.json()) as Office & { error?: string };
      if (!r.ok) throw Error(d.error);
      setData(d);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load office");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  async function save(payload: Record<string, unknown>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const r = await fetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = (await r.json()) as { error?: string };
      if (!r.ok) throw Error(d.error);
      setNotice("Saved successfully.");
      await load();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function form(e: React.FormEvent<HTMLFormElement>, action: string) {
    e.preventDefault();
    const el = e.currentTarget;
    const payload = Object.fromEntries(new FormData(el).entries());
    if (action === "fixture" || action === "fixture-update")
      payload.kickoff = new Date(String(payload.kickoff)).toISOString();
    if (await save({ action, ...payload })) {
      el.reset();
      if (action === "fixture-update") setEditingFixture(null);
      if (action === "standing") setEditingStanding(null);
      if (action === "player") setEditingPlayer(null);
    }
  }
  return (
    <main className="office-page">
      <div className="office-top">
        {canMembership ? <Link href="/admin">← Member registry</Link> : <span />}
        {role === "executive" && <a className="executive-admin-button" href="/admin-access">Manage administrators →</a>}
        <Link href="/club">View club page ↗</Link>
        <button className="admin-signout" onClick={async()=>{await fetch("/api/admin-pin",{method:"DELETE"});location.assign("/api/auth/signout?callbackUrl=/")}}>Sign out</button>
      </div>
      <div className="member-heading">
        <div>
          <p className="eyebrow">TOWNSHIP ROLLERS FC</p>
          <h1>Club office</h1>
          <p>{name} · <strong>{roleLabels[role]}</strong></p>
        </div>
      </div>
      {loading && <p>Loading office…</p>}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="form-success">
          {notice}
        </p>
      )}
      {canMembership && <>
      <section className="member-panel">
        <h2>Proof of payment · P200 per member</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Member</th>
                <th>Submitted</th>
                <th>Reference</th>
                <th>Proof</th>
                <th>Status</th>
                <th>Decision</th>
              </tr>
            </thead>
            <tbody>
              {data.payments.map((p) => (
                <tr key={p.id}>
                  <td>
                    <b>
                      {p.firstName} {p.lastName}
                    </b>
                    <br />
                    <small>{p.memberId}</small>
                  </td>
                  <td>{new Date(p.createdAt).toLocaleString("en-BW")}</td>
                  <td>{p.reference || "—"}</td>
                  <td>
                    <a
                      href={"/api/staff/receipt/" + encodeURIComponent(p.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View {p.receiptName}
                    </a>
                  </td>
                  <td>
                    <span className={"badge " + p.status}>{p.status}</span>
                    {p.note && <small className="office-note">{p.note}</small>}
                  </td>
                  <td>
                    {p.status === "submitted" ? (
                      <div className="office-actions">
                        <button
                          disabled={busy}
                          className="primary"
                          onClick={() =>
                            void save({
                              action: "review",
                              id: p.id,
                              status: "approved",
                            })
                          }
                        >
                          Approve
                        </button>
                        <button
                          disabled={busy}
                          className="secondary"
                          onClick={() => {
                            const note = window.prompt(
                              "Reason for rejection (optional)",
                            );
                            if (note !== null)
                              void save({
                                action: "review",
                                id: p.id,
                                status: "rejected",
                                note,
                              });
                          }}
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data.payments.length && (
            <p className="muted">No payment proofs submitted yet.</p>
          )}
        </div>
      </section>
      <section className="member-panel expiry-settings-panel">
        <div>
          <p className="eyebrow">MEMBERSHIP SETTINGS</p>
          <h2>Expiry and renewal</h2>
          <p className="muted">
            Control how long an approved membership remains active and when
            members see an expiry reminder.
          </p>
        </div>
        <form
          className="office-form expiry-settings-form"
          onSubmit={(e) => void form(e, "expiry-settings")}
        >
          <label>
            Membership validity (days)
            <input
              type="number"
              name="membershipValidityDays"
              min="1"
              max="3650"
              defaultValue={data.settings.membershipValidityDays}
              key={"validity-" + data.settings.membershipValidityDays}
              required
            />
          </label>
          <label>
            Reminder before expiry (days)
            <input
              type="number"
              name="expiryReminderDays"
              min="0"
              max={data.settings.membershipValidityDays}
              defaultValue={data.settings.expiryReminderDays}
              key={"reminder-" + data.settings.expiryReminderDays}
              required
            />
          </label>
          <button disabled={busy} className="primary">
            Save expiry settings
          </button>
        </form>
      </section>
      </>}
      {canOperations && <>
      <div className="member-columns">
        <section className="member-panel fixture-create-panel">
          <h2>Add a fixture</h2>
          <form
            className="office-form"
            onSubmit={(e) => void form(e, "fixture")}
          >
            <label className="team-field">
              Opponent
              <input name="opponent" required maxLength={100} />
            </label>
            <label>
              Kickoff date and time
              <input type="datetime-local" name="kickoff" required />
            </label>
            <label>
              Venue
              <input name="venue" required maxLength={120} />
            </label>
            <label>
              Home or away
              <select name="homeAway">
                <option value="home">Home</option>
                <option value="away">Away</option>
              </select>
            </label>
            <label>
              Competition
              <input
                name="competition"
                maxLength={100}
                placeholder="Premier League"
              />
            </label>
            <button disabled={busy} className="primary">
              Publish fixture
            </button>
          </form>
        </section>
        <section className="member-panel">
          <h2>Record a result</h2>
          <form
            className="office-form"
            onSubmit={(e) => void form(e, "result")}
          >
            <label>
              Fixture
              <select name="id" required defaultValue="">
                <option value="">Choose a fixture</option>
                {data.fixtures
                  .filter((f) => f.status === "upcoming")
                  .map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.opponent} ·{" "}
                      {new Date(f.kickoff).toLocaleDateString("en-BW")}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Rollers goals
              <input
                type="number"
                name="rollersScore"
                min="0"
                max="99"
                required
              />
            </label>
            <label>
              Opponent goals
              <input
                type="number"
                name="opponentScore"
                min="0"
                max="99"
                required
              />
            </label>
            <button disabled={busy} className="primary">
              Publish result
            </button>
          </form>
        </section>
      </div>
      <section className="member-panel">
        <h2>Published fixtures</h2>
        <div className="admin-fixture-list">
          {data.fixtures.map((f) => (
            <article className="admin-fixture-card" key={f.id}>
              {editingFixture === f.id ? (
                <form
                  className="office-form"
                  onSubmit={(e) => void form(e, "fixture-update")}
                >
                  <input type="hidden" name="id" value={f.id} />
                  <label className="team-field">
                    Opponent
                    <input
                      name="opponent"
                      defaultValue={f.opponent}
                      required
                      maxLength={100}
                    />
                  </label>
                  <label>
                    Kickoff date and time
                    <input
                      type="datetime-local"
                      name="kickoff"
                      defaultValue={new Date(f.kickoff)
                        .toISOString()
                        .slice(0, 16)}
                      required
                    />
                  </label>
                  <label>
                    Venue
                    <input
                      name="venue"
                      defaultValue={f.venue}
                      required
                      maxLength={120}
                    />
                  </label>
                  <label>
                    Home or away
                    <select name="homeAway" defaultValue={f.homeAway}>
                      <option value="home">Home</option>
                      <option value="away">Away</option>
                    </select>
                  </label>
                  <label>
                    Competition
                    <input
                      name="competition"
                      defaultValue={f.competition || ""}
                      maxLength={100}
                    />
                  </label>
                  <div className="office-actions">
                    <button disabled={busy} className="primary">
                      Save fixture
                    </button>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => setEditingFixture(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="admin-fixture-team">
                    <strong>Township Rollers vs {f.opponent}</strong>
                    <span>{f.homeAway.toUpperCase()}</span>
                  </div>
                  <p>
                    {new Date(f.kickoff).toLocaleString("en-BW")} · {f.venue}
                  </p>
                  <small>
                    {f.competition || "Premier League"} · {f.status}
                  </small>
                  <button
                    className="secondary"
                    onClick={() => setEditingFixture(f.id)}
                  >
                    Edit fixture
                  </button>
                </>
              )}
            </article>
          ))}
        </div>
        {!data.fixtures.length && (
          <p className="muted">No fixtures published yet.</p>
        )}
      </section>
      </>}
      {canCoach && <>
      <section className="member-panel squad-admin">
        <div className="panel-head">
          <div>
            <p className="eyebrow">SQUAD MANAGEMENT</p>
            <h2>
              {editingPlayer
                ? "Edit player and contract"
                : "Add player and contract"}
            </h2>
          </div>
          <p>
            {data.players.filter((p) => ["first_eleven", "sub_out"].includes(p.lineupRole)).length}
            /11 starters selected
          </p>
        </div>
        <form
          className="office-form player-form"
          key={editingPlayer?.id || "new-player"}
          onSubmit={(e) => void form(e, "player")}
        >
          {editingPlayer && (
            <input type="hidden" name="id" value={editingPlayer.id} />
          )}
          <div className="player-form-grid">
            <label>
              First name
              <input
                name="firstName"
                defaultValue={editingPlayer?.firstName || ""}
                required
                maxLength={80}
              />
            </label>
            <label>
              Last name
              <input
                name="lastName"
                defaultValue={editingPlayer?.lastName || ""}
                required
                maxLength={80}
              />
            </label>
            <label>
              Squad number
              <input
                type="number"
                name="squadNumber"
                min="1"
                max="99"
                defaultValue={editingPlayer?.squadNumber || ""}
                required
              />
            </label>
            <label>
              Position
              <select
                name="position"
                defaultValue={editingPlayer?.position || "Goalkeeper"}
              >
                <option>Goalkeeper</option>
                <option>Defender</option>
                <option>Midfielder</option>
                <option>Forward</option>
              </select>
            </label>
              <label className="match-role-field">
                Match role
              <select
                name="lineupRole"
                defaultValue={editingPlayer?.lineupRole || "squad"}
              >
                  <option value="first_eleven">Starting eleven</option>
                  <option value="substitute">Substitute</option>
                  <option value="sub_out">▼ Substitution — going out</option>
                  <option value="sub_in">▲ Substitution — coming in</option>
                  <option value="squad">Squad</option>
              </select>
            </label>
            <label>
              Player status
              <select
                name="status"
                defaultValue={editingPlayer?.status || "active"}
              >
                <option value="active">Active</option>
                <option value="injured">Injured</option>
                <option value="loaned">Loaned</option>
                <option value="released">Released</option>
              </select>
            </label>
            <label>
              Contract type
              <select
                name="contractType"
                defaultValue={editingPlayer?.contractType || "Permanent"}
              >
                <option>Permanent</option>
                <option>Loan</option>
                <option>Development</option>
                <option>Short-term</option>
              </select>
            </label>
            <label>
              Contract start
              <input
                type="date"
                name="contractStart"
                defaultValue={editingPlayer?.contractStart || ""}
              />
            </label>
            <label>
              Contract end
              <input
                type="date"
                name="contractEnd"
                defaultValue={editingPlayer?.contractEnd || ""}
              />
            </label>
          </div>
          <div className="office-actions">
            <button disabled={busy} className="primary">
              {editingPlayer ? "Save player changes" : "Add player"}
            </button>
            {editingPlayer && (
              <button
                type="button"
                className="secondary"
                onClick={() => setEditingPlayer(null)}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
        <div className="table-wrap player-register">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Player</th>
                <th>Position</th>
                <th>Match role</th>
                <th>Contract</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.players.map((p) => (
                <tr key={p.id}>
                  <td>
                    <b>{p.squadNumber}</b>
                  </td>
                  <td>
                    {p.firstName} {p.lastName}
                  </td>
                  <td>{p.position}</td>
                  <td>
                        {p.lineupRole === "sub_out" ? (
                          <span className="sub-marker sub-out"><i aria-hidden="true">▼</i> Going out</span>
                        ) : p.lineupRole === "sub_in" ? (
                          <span className="sub-marker sub-in"><i aria-hidden="true">▲</i> Coming in</span>
                        ) : p.lineupRole === "first_eleven" ? (
                          "Starting XI"
                        ) : p.lineupRole === "substitute" ? (
                          "Substitute"
                        ) : (
                          "Squad"
                        )}
                  </td>
                  <td>
                    <b>{p.contractType}</b>
                    <br />
                    <small>
                      {p.contractStart || "—"} → {p.contractEnd || "—"}
                    </small>
                  </td>
                  <td>
                    <span className={"badge " + p.status}>{p.status}</span>
                  </td>
                  <td>
                    <div className="team-actions">
                      <button
                        className="secondary"
                        onClick={() => {
                          setEditingPlayer(p);
                          document
                            .querySelector(".squad-admin")
                            ?.scrollIntoView({
                              behavior: "smooth",
                              block: "start",
                            });
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="danger-button"
                        disabled={busy}
                        onClick={() => {
                          if (
                            window.confirm(
                              `Delete ${p.firstName} ${p.lastName} from the player list?`,
                            )
                          )
                            void save({ action: "player-delete", id: p.id });
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data.players.length && (
            <p className="muted">No players have been added yet.</p>
          )}
        </div>
      </section>
      </>}
      {canOperations && <>
      <div className="member-columns">
        <section className="member-panel">
          <h2>
            {editingStanding ? "Edit team standing" : "Add team standing"}
          </h2>
          <p className="muted">
            Create a team row or select Edit from the database below.
          </p>
          <form
            className="office-form"
            key={editingStanding?.team || "new-standing"}
            onSubmit={(e) => void form(e, "standing")}
          >
            {editingStanding && (
              <input
                type="hidden"
                name="originalTeam"
                value={editingStanding.team}
              />
            )}
            <label>
              Team
              <input
                name="team"
                defaultValue={editingStanding?.team || ""}
                required
                maxLength={100}
              />
            </label>
            <div className="office-numbers">
              {[
                ["played", "Played"],
                ["won", "Won"],
                ["drawn", "Drawn"],
                ["lost", "Lost"],
                ["goalDifference", "Goal difference"],
                ["points", "Points"],
              ].map(([key, label]) => (
                <label key={key}>
                  {label}
                  <input
                    type="number"
                    name={key}
                    defaultValue={
                      editingStanding
                        ? Number(editingStanding[key as keyof Standing])
                        : 0
                    }
                    required
                  />
                </label>
              ))}
            </div>
            <div className="office-actions">
              <button disabled={busy} className="primary">
                {editingStanding ? "Save changes" : "Save team standing"}
              </button>
              {editingStanding && (
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setEditingStanding(null)}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
          <p className="muted">{data.standings.length} teams entered</p>
        </section>
        <section className="member-panel">
          <h2>Organisation update</h2>
          <form
            className="office-form"
            onSubmit={(e) => void form(e, "update")}
          >
            <label>
              Title
              <input name="title" maxLength={150} required />
            </label>
            <label>
              Message
              <textarea name="body" rows={7} maxLength={3000} required />
            </label>
            <button disabled={busy} className="primary">
              Publish to members
            </button>
          </form>
          <p className="muted">
            Published here and on the club page. Internal office communiqués
            remain separate.
          </p>
        </section>
      </div>
      <section className="member-panel">
        <div className="panel-head">
          <div>
            <h2>Team database</h2>
            <p>{data.standings.length} teams in the standings</p>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Team</th>
                <th>P</th>
                <th>W</th>
                <th>D</th>
                <th>L</th>
                <th>GD</th>
                <th>Pts</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.standings.map((s) => (
                <tr key={s.team}>
                  <td>
                    <b>{s.team}</b>
                  </td>
                  <td>{s.played}</td>
                  <td>{s.won}</td>
                  <td>{s.drawn}</td>
                  <td>{s.lost}</td>
                  <td>{s.goalDifference}</td>
                  <td>
                    <b>{s.points}</b>
                  </td>
                  <td>
                    <div className="team-actions">
                      <button
                        className="secondary"
                        onClick={() => {
                          setEditingStanding(s);
                          window.scrollTo({
                            top: document.body.scrollHeight - 900,
                            behavior: "smooth",
                          });
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="danger-button"
                        disabled={busy}
                        onClick={() => {
                          if (
                            window.confirm(
                              `Delete ${s.team} from the standings?`,
                            )
                          )
                            void save({
                              action: "standing-delete",
                              team: s.team,
                            });
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data.standings.length && (
            <p className="muted">No teams have been added yet.</p>
          )}
        </div>
      </section>
      </>}
    </main>
  );
}
