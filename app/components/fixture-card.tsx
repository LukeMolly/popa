type Fixture = {
  id: string;
  opponent: string;
  kickoff: string;
  venue: string;
  homeAway: string;
  competition: string;
};

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

function TeamBadge({name, rollers = false}: {name: string; rollers?: boolean}) {
  return (
    <div className="fixture-team">
      <span
        className={rollers ? "fixture-logo rollers-logo" : "fixture-logo opponent-logo"}
        role="img"
        aria-label={rollers ? "Township Rollers FC crest" : `${name} badge`}
      >
        {!rollers && initials(name)}
      </span>
      <strong>{name}</strong>
    </div>
  );
}

export function FixtureCard({fixture}: {fixture: Fixture}) {
  const away = fixture.homeAway === "away";
  return (
    <article className="fixture-card">
      <div className="fixture-competition">{fixture.competition || "Premier League"}</div>
      <div className="fixture-matchup">
        {away ? <TeamBadge name={fixture.opponent}/> : <TeamBadge name="Township Rollers" rollers/>}
        <div className="fixture-versus"><span>VS</span><small>{away ? "AWAY" : "HOME"}</small></div>
        {away ? <TeamBadge name="Township Rollers" rollers/> : <TeamBadge name={fixture.opponent}/>}
      </div>
      <div className="fixture-details">
        <span>{new Date(fixture.kickoff).toLocaleString("en-BW", {dateStyle: "medium", timeStyle: "short"})}</span>
        <span>{fixture.venue}</span>
      </div>
    </article>
  );
}
