"use client";
import { useEffect, useState } from "react";
import { FixtureCard } from "../components/fixture-card";

type Player = {
  id: string;
  firstName: string;
  lastName: string;
  squadNumber: number;
  position: string;
  contractEnd: string;
  status: string;
  lineupRole: string;
};
type Club = {
  fixtures: Array<{
    id: string;
    opponent: string;
    kickoff: string;
    venue: string;
    homeAway: string;
    competition: string;
  }>;
  results: Array<{
    id: string;
    opponent: string;
    kickoff: string;
    rollersScore: number;
    opponentScore: number;
    homeAway: string;
  }>;
  standings: Array<{
    team: string;
    played: number;
    goalDifference: number;
    points: number;
  }>;
  updates: Array<{
    id: number;
    title: string;
    body: string;
    createdAt: string;
  }>;
  players: Player[];
  officialMatch: {
    opponent: string;
    date: string;
    formation: string;
    score: string;
    sourceLabel: string;
    players: Player[];
    substitutions: Array<{ minute: number; playerIn: string; playerOut: string }>;
  };
};
export default function ClubPage() {
  const [data, setData] = useState<Club | null>(null),
    [error, setError] = useState(""),
    [shareState, setShareState] = useState("");
  useEffect(() => {
    fetch("/api/club", { cache: "no-store" })
      .then(async (r) => {
        const d = (await r.json()) as Club & { error?: string };
        if (!r.ok) throw Error(d.error);
        setData(d);
      })
      .catch((e) => setError(e.message));
  }, []);
  const matchPlayers = data?.officialMatch.players || [],
    starters =
      matchPlayers.filter((p) =>
        ["first_eleven", "sub_out"].includes(p.lineupRole),
      ) || [],
    subs =
      matchPlayers.filter((p) =>
        ["substitute", "sub_in"].includes(p.lineupRole),
      ) || [],
    substitutionByIncomingNumber: Record<
      number,
      { minute: number; playerIn: string; playerOut: string } | undefined
    > = {
      12: data?.officialMatch.substitutions[0],
      77: data?.officialMatch.substitutions[1],
      23: data?.officialMatch.substitutions[2],
      25: data?.officialMatch.substitutions[3],
    };
  async function shareTeamList() {
    if (!data) return;
    const starterLines = starters.map(
      (p, index) => `${index + 1}. #${p.squadNumber} ${p.firstName} ${p.lastName}`,
    );
    const substituteLines = subs.map((p) => {
      const change = substitutionByIncomingNumber[p.squadNumber];
      return change
        ? `#${p.squadNumber} ${p.firstName} ${p.lastName} — in for ${change.playerOut} (${change.minute}′)`
        : `#${p.squadNumber} ${p.firstName} ${p.lastName}`;
    });
    const text = [
      `Township Rollers Vs ${data.officialMatch.opponent}`,
      `${data.officialMatch.date} · ${data.officialMatch.formation} · FT ${data.officialMatch.score}`,
      "",
      "STARTING XI",
      ...starterLines,
      "",
      "SUBSTITUTES",
      ...substituteLines,
    ].join("\n");
    try {
      if (navigator.share) {
        await navigator.share({ title: "Township Rollers Team List", text });
        setShareState("Shared");
      } else {
        await navigator.clipboard.writeText(text);
        setShareState("Copied");
      }
      window.setTimeout(() => setShareState(""), 2500);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setShareState("Could not share");
      window.setTimeout(() => setShareState(""), 2500);
    }
  }
  return (
    <main className="club-page">
      <header className="club-hero">
        <span className="mini-crest">TR</span>
        <p>TOWNSHIP ROLLERS FC</p>
        <h1>Popa Popa</h1>
        <span>Fixtures, team, results and club news</span>
      </header>
      <div className="club-sections">
        {error ? (
          <p role="alert">{error}</p>
        ) : !data ? (
          <p>Loading club updates…</p>
        ) : (
          <>
            <section className="member-panel">
              <h2>Next fixtures</h2>
              {data.fixtures.length ? (
                data.fixtures.map((f) => <FixtureCard key={f.id} fixture={f} />)
              ) : (
                <p className="muted">No fixtures published yet.</p>
              )}
            </section>
            <section className="member-panel results-panel">
              <h2>Latest results</h2>
              {data.results.length ? (
                data.results.map((f) => (
                  <article className="match-row result-card" key={f.id}>
                    <strong>
                      {f.homeAway === "away"
                        ? `${f.opponent} ${f.opponentScore} – ${f.rollersScore} Township Rollers`
                        : `Township Rollers ${f.rollersScore} – ${f.opponentScore} ${f.opponent}`}
                    </strong>
                    <span>
                      {new Date(f.kickoff).toLocaleDateString("en-BW")}
                    </span>
                  </article>
                ))
              ) : (
                <p className="muted">No results published yet.</p>
              )}
            </section>
            <section className="member-panel lineup-panel">
              <div className="match-lineup-head"><div><small>20 September 2026 · 4-3-3</small><h2>Township Rollers Vs Extension Gunners</h2></div><div className="match-head-actions"><b>FT 3–0</b><button type="button" className="share-team-button" onClick={shareTeamList}>↗ {shareState || "Share team list"}</button></div></div>
              <div className="lineup-list">
                {starters.map((p) => (
                  <article
                    className={`lineup-player ${p.lineupRole === "sub_out" ? "going-out" : ""}`}
                    key={p.id}
                  >
                    <b>{p.squadNumber}</b>
                    <span>
                      <strong>
                        {p.firstName} {p.lastName}
                      </strong>
                      <small>{p.position}</small>
                    </span>
                    {p.lineupRole === "sub_out" && (
                      <em className="lineup-out-arrow" aria-label="Substituted out">▼</em>
                    )}
                  </article>
                ))}
              </div>
              {!starters.length && (
                <p className="muted">Starting eleven not selected yet.</p>
              )}
            </section>
            <section className="member-panel substitutes-panel">
              <h2>Substitutes</h2>
              <div className="lineup-list">
                {subs.map((p) => {
                  const change = substitutionByIncomingNumber[p.squadNumber];
                  return (
                    <article
                      className={`lineup-player ${p.lineupRole === "sub_in" ? "coming-in" : ""}`}
                      key={p.id}
                    >
                      <b>{p.squadNumber}</b>
                      <span>
                        <strong>
                          {p.firstName} {p.lastName}
                        </strong>
                        <small>{p.position}</small>
                        {change && (
                          <em className="sub-marker sub-in substitution-exchange">
                            <i aria-hidden="true">▲</i> In for {change.playerOut} · {change.minute}′
                          </em>
                        )}
                      </span>
                    </article>
                  );
                })}
              </div>
              {!subs.length && (
                <p className="muted">Substitutes not selected yet.</p>
              )}
            </section>
            <section className="member-panel substitution-timeline">
              <div className="match-lineup-head"><div><small>OFFICIAL MATCH CHANGES</small><h2>Substitutions</h2></div><b>{data.officialMatch.substitutions.length} changes</b></div>
              <div className="sub-events">{data.officialMatch.substitutions.map((s,index)=><article className="sub-event" key={`${s.minute}-${index}`}><strong>{s.minute}′</strong><div><span className="sub-marker sub-in"><i aria-hidden="true">▲</i> {s.playerIn}</span><span className="sub-marker sub-out"><i aria-hidden="true">▼</i> {s.playerOut}</span></div></article>)}</div>
              <p className="match-source">Confirmed from {data.officialMatch.sourceLabel}.</p>
            </section>
            <section className="member-panel squad-panel">
              <h2>Team player list</h2>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Player</th>
                      <th>Position</th>
                      <th>Match role</th>
                      <th>Contract</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.players.length ? data.players : matchPlayers).map((p) => (
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
                          {p.contractEnd
                            ? `To ${new Date(p.contractEnd + "T00:00:00").toLocaleDateString("en-BW")}`
                            : "Not published"}
                        </td>
                        <td>
                          <span className={"badge " + p.status}>
                            {p.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!data.players.length && <p className="match-source">Showing today’s official match squad. Contract dates can be added from the Club Office.</p>}
              </div>
            </section>
            <section className="member-panel standings-panel">
              <h2>League standings</h2>
              <div className="table-wrap standings-table">
                <table>
                  <thead>
                    <tr>
                      <th>Team</th>
                      <th>P</th>
                      <th>GD</th>
                      <th>Pts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.standings.map((s) => (
                      <tr key={s.team}>
                        <td>{s.team}</td>
                        <td>{s.played}</td>
                        <td>{s.goalDifference}</td>
                        <td>{s.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!data.standings.length && (
                  <p className="muted">No standings published yet.</p>
                )}
              </div>
            </section>
            <section className="member-panel">
              <h2>Organisation updates</h2>
              {data.updates.length ? (
                data.updates.map((u) => (
                  <article className="update" key={u.id}>
                    <small>
                      {new Date(u.createdAt).toLocaleDateString("en-BW")}
                    </small>
                    <h3>{u.title}</h3>
                    <p>{u.body}</p>
                  </article>
                ))
              ) : (
                <p className="muted">No updates published yet.</p>
              )}
            </section>
          </>
        )}
      </div>
      <footer className="club-footer">
        Season membership · P200 · Contact the club for registration and
        official payment details.
      </footer>
    </main>
  );
}
