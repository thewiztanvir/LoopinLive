import { NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// ESPN API Configuration
// ---------------------------------------------------------------------------
const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer";

// Must include browser-like headers; ESPN blocks bare Node.js requests
const ESPN_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/json",
  Origin: "https://www.espn.com",
  Referer: "https://www.espn.com/",
};

// ---------------------------------------------------------------------------
// League catalogue  (slug → display + logo)
// Logo IDs sourced from ESPN CDN league logos
// ---------------------------------------------------------------------------
const LEAGUES = [
  {
    slug: "eng.1",
    name: "Premier League",
    logo: "https://a.espncdn.com/i/leaguelogos/soccer/500/23.png",
  },
  {
    slug: "esp.1",
    name: "La Liga",
    logo: "https://a.espncdn.com/i/leaguelogos/soccer/500/87.png",
  },
  {
    slug: "ger.1",
    name: "Bundesliga",
    logo: "https://a.espncdn.com/i/leaguelogos/soccer/500/10.png",
  },
  {
    slug: "ita.1",
    name: "Serie A",
    logo: "https://a.espncdn.com/i/leaguelogos/soccer/500/55.png",
  },
  {
    slug: "fra.1",
    name: "Ligue 1",
    logo: "https://a.espncdn.com/i/leaguelogos/soccer/500/9.png",
  },
  {
    slug: "uefa.champions",
    name: "Champions League",
    logo: "https://a.espncdn.com/i/leaguelogos/soccer/500/2.png",
  },
  {
    slug: "fifa.world",
    name: "FIFA World Cup",
    logo: "https://a.espncdn.com/i/leaguelogos/soccer/500/4.png",
  },
];

// ---------------------------------------------------------------------------
// Exported interfaces (matched by SportsHub.tsx)
// ---------------------------------------------------------------------------
export interface MatchEvent {
  minute: number;
  type: "goal" | "card" | "sub";
  detail: string;
  team: "home" | "away";
}

export interface MatchStats {
  possession: number;
  shotsOnTarget: number;
  corners: number;
  fouls: number;
}

export interface Match {
  id: string;
  competition: string;
  competitionLogo: string;
  homeTeam: string;
  homeLogo: string;
  awayTeam: string;
  awayLogo: string;
  status: "LIVE" | "HT" | "FT" | "SCHEDULED";
  elapsed: number;
  elapsedDisplay: string;
  homeScore: number;
  awayScore: number;
  startTime: string;
  events: MatchEvent[];
  stats: MatchStats;
  broadcasterRecommendation?: string;
  venue?: string;
  leagueSlug: string;
}

export interface StandingTeam {
  position: number;
  name: string;
  logo: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  form: ("W" | "D" | "L")[];
}

export interface CompetitionStandings {
  competition: string;
  groupName?: string; // e.g. "Group A" for tournaments with multiple groups
  table: StandingTeam[];
}

// ---------------------------------------------------------------------------
// Internal raw match shape (includes extra fields used during processing)
// ---------------------------------------------------------------------------
interface RawMatch extends Match {
  leagueSlug: string;
  homeTeamId: string;
  awayTeamId: string;
}

// ---------------------------------------------------------------------------
// Simple in-memory cache  (30-second TTL)
// ---------------------------------------------------------------------------
let cache: { data: { matches: Match[]; standings: CompetitionStandings[] }; ts: number } | null = null;
const CACHE_TTL = 30_000;

// ---------------------------------------------------------------------------
// Helper: map ESPN status object → our status enum
// ---------------------------------------------------------------------------
function mapStatus(eventStatus: {
  type: { state: string; detail: string; completed: boolean };
}): "LIVE" | "HT" | "FT" | "SCHEDULED" {
  const { state, detail, completed } = eventStatus.type;
  if (completed || state === "post") return "FT";
  if (state === "in") {
    if (detail === "HT" || detail?.toLowerCase() === "half time") return "HT";
    return "LIVE";
  }
  return "SCHEDULED";
}

// ---------------------------------------------------------------------------
// Helper: derive elapsed minutes + display string from ESPN status object
// ---------------------------------------------------------------------------
function getElapsed(eventStatus: {
  clock?: number;
  displayClock?: string;
  type: { state: string; detail: string };
}): { elapsed: number; elapsedDisplay: string } {
  const { state, detail } = eventStatus.type;

  if (state === "post") return { elapsed: 90, elapsedDisplay: "FT" };
  if (detail === "HT") return { elapsed: 45, elapsedDisplay: "HT" };
  if (state === "pre") return { elapsed: 0, elapsedDisplay: "" };

  // LIVE: clock is in seconds remaining on the period timer
  // ESPN's displayClock is the formatted "MM:SS" countdown, not elapsed.
  // The detail string (e.g. "33'") gives the elapsed display directly.
  const elapsed = eventStatus.clock ? Math.floor(eventStatus.clock / 60) : 0;
  const elapsedDisplay = detail || "";
  return { elapsed, elapsedDisplay };
}

// ---------------------------------------------------------------------------
// ESPN keyword event type → our type
// ---------------------------------------------------------------------------
const ESPN_EVENT_TYPE_MAP: Record<string, "goal" | "card" | "sub"> = {
  goal: "goal",
  "goal---header": "goal",
  "goal---penalty": "goal",
  "penalty-goal": "goal",
  "goal---own-goal": "goal",
  "yellow-card": "card",
  "red-card": "card",
  "yellow-red-card": "card",
  substitution: "sub",
};

// ---------------------------------------------------------------------------
// Map ESPN keyEvents array → our MatchEvent[]
// teamId comparison: ESPN stores competitor homeTeam ID and awayTeam ID as
// strings.  We received them from the scoreboard competitor objects.
// ---------------------------------------------------------------------------
function mapKeyEvents(
  keyEvents: Array<{
    type?: { type?: string };
    clock?: { displayValue?: string };
    text?: string;
    teamId?: string | number;
    team?: { id?: string | number };
    participants?: any[];
    shortText?: string;
  }>,
  homeTeamId: string,
  awayTeamId: string
): MatchEvent[] {
  const events: MatchEvent[] = [];

  for (const e of keyEvents) {
    const typeKey = e.type?.type || "";
    const mapped = ESPN_EVENT_TYPE_MAP[typeKey];
    if (!mapped) continue;

    const clockStr = e.clock?.displayValue || "";
    // clockStr format: "33'" or "45'+2'"
    const minute = parseInt(clockStr.replace("'", "").split("+")[0], 10) || 0;

    // Use e.team?.id for reliable team matching, fall back to e.teamId
    const eventTeamId = String(e.team?.id ?? e.teamId ?? "");
    // If teamId matches awayTeamId → away; otherwise default home
    const team: "home" | "away" =
      eventTeamId === String(awayTeamId) ? "away" : "home";

    // Format detail cleanly: only show player names for goals/cards/subs
    let detail = "";
    if (mapped === "sub") {
      const pIn = e.participants?.[0]?.athlete?.displayName;
      const pOut = e.participants?.[1]?.athlete?.displayName;
      if (pIn && pOut) {
        detail = `${pIn} 🔄 ${pOut}`;
      } else {
        detail = e.shortText || e.text || "";
      }
    } else {
      detail = e.participants?.[0]?.athlete?.displayName || e.shortText || e.text || "";
    }

    events.push({ minute, type: mapped, detail, team });
  }

  // Sort ascending by minute (chronological)
  return events.sort((a, b) => a.minute - b.minute);
}

// ---------------------------------------------------------------------------
// Map ESPN boxscore teams → our MatchStats
// Confirmed stat names from API inspection:
//   possessionPct, shotsOnTarget, wonCorners, foulsCommitted
// ---------------------------------------------------------------------------
function mapStats(
  boxscoreTeams: Array<{
    team?: { name?: string; displayName?: string };
    statistics?: Array<{ name: string; value?: number; displayValue?: string }>;
  }>,
  homeTeamName: string
): MatchStats {
  // Find home team in boxscore; fallback to first team
  const homeTeam =
    boxscoreTeams.find(
      (t) =>
        t.team?.name === homeTeamName ||
        t.team?.displayName === homeTeamName
    ) || boxscoreTeams[0];

  if (!homeTeam?.statistics) {
    return { possession: 50, shotsOnTarget: 0, corners: 0, fouls: 0 };
  }

  const getStat = (name: string): number => {
    const s = homeTeam.statistics!.find((s) => s.name === name);
    if (!s) return 0;
    const raw = s.value ?? parseFloat(s.displayValue ?? "0");
    return isNaN(raw) ? 0 : raw;
  };

  return {
    possession: Math.round(getStat("possessionPct")),
    shotsOnTarget: Math.round(getStat("shotsOnTarget")),
    corners: Math.round(getStat("wonCorners")),
    fouls: Math.round(getStat("foulsCommitted")),
  };
}

// ---------------------------------------------------------------------------
// Map ESPN summary.standings → our CompetitionStandings
// CONFIRMED from live API:
//   - entry.team is a PLAIN STRING (not an object)
//   - entry.logo is a SEPARATE ARRAY  [{href: "..."}]
//   - stat names: gamesPlayed, wins, losses, ties, points, pointDifferential, rank
//   - No goalsFor/goalsAgainst available; use 0
// ---------------------------------------------------------------------------
function mapStandings(
  standingsData: any,
  leagueName: string
): CompetitionStandings[] {
  try {
    const children = standingsData?.children ?? [];
    if (children.length === 0) return [];

    const result: CompetitionStandings[] = [];

    children.forEach((child: any) => {
      const entries = child.standings?.entries ?? [];
      if (entries.length === 0) return;

      const table: StandingTeam[] = entries.map((entry: any, i: number) => {
        const stats = entry.stats ?? [];

        const getStat = (name: string): number => {
          const s = stats.find((s: any) => s.name === name);
          if (!s) return 0;
          const v = s.value ?? parseInt(s.displayValue ?? "0", 10);
          return isNaN(Number(v)) ? 0 : Number(v);
        };

        const rank = getStat("rank") || i + 1;
        const won = getStat("wins");
        const lost = getStat("losses");
        const drawn = getStat("ties");
        const played = getStat("gamesPlayed");
        const points = getStat("points");
        const gd = getStat("pointDifferential");

        // Resolve logo: handles both dedicated standings (team object) and scoreboard standings (logo array)
        let logo = "";
        if (entry.team && typeof entry.team === "object") {
          logo = entry.team.logos?.[0]?.href ?? "";
        } else if (Array.isArray(entry.logo)) {
          logo = entry.logo[0]?.href ?? "";
        }

        // Resolve team name
        let name = "";
        if (entry.team && typeof entry.team === "object") {
          name = entry.team.displayName || entry.team.name || "";
        } else {
          name = String(entry.team ?? "");
        }

        return {
          position: rank,
          name,
          logo,
          played,
          won,
          drawn,
          lost,
          points,
          goalsFor: 0,
          goalsAgainst: 0,
          goalDifference: gd,
          form: [] as ("W" | "D" | "L")[],
        };
      });

      table.sort((a, b) => a.position - b.position);

      const childName = child.name || child.abbreviation || "";
      const isGroup = childName.toLowerCase().includes("group");
      
      let groupName: string | undefined = undefined;
      if (isGroup || children.length > 1) {
        groupName = childName.startsWith("Group") ? childName : `Group ${childName}`;
      }

      result.push({
        competition: leagueName,
        groupName,
        table,
      });
    });

    return result;
  } catch (err) {
    console.error("[football/route] Error parsing standings:", err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Fetch a single ESPN scoreboard for a specific date (YYYYMMDD) and return raw match objects
// ---------------------------------------------------------------------------
async function fetchScoreboardForDate(
  league: (typeof LEAGUES)[0],
  dateStr?: string // YYYYMMDD format; omit for today
): Promise<RawMatch[]> {
  try {
    const url = dateStr
      ? `${ESPN_BASE}/${league.slug}/scoreboard?dates=${dateStr}`
      : `${ESPN_BASE}/${league.slug}/scoreboard`;
    const res = await fetch(url, {
      headers: ESPN_HEADERS,
      next: { revalidate: 30 },
    });
    if (!res.ok) return [];

    const data = await res.json();
    const events: unknown[] = Array.isArray(data.events) ? data.events : [];

    const matches: RawMatch[] = [];

    for (const event of events as Array<Record<string, unknown>>) {
      const competition = (event.competitions as Array<Record<string, unknown>>)?.[0];
      if (!competition) continue;

      const competitors = (competition.competitors as Array<Record<string, unknown>>) ?? [];
      const homeComp = competitors.find((c) => c.homeAway === "home") as Record<string, unknown> | undefined;
      const awayComp = competitors.find((c) => c.homeAway === "away") as Record<string, unknown> | undefined;
      if (!homeComp || !awayComp) continue;

      const homeTeamObj = homeComp.team as Record<string, unknown>;
      const awayTeamObj = awayComp.team as Record<string, unknown>;

      const status = mapStatus(event.status as { type: { state: string; detail: string; completed: boolean } });
      const { elapsed, elapsedDisplay } = getElapsed(
        event.status as { clock?: number; displayClock?: string; type: { state: string; detail: string } }
      );

      const homeScore = parseInt(String(homeComp.score ?? "0"), 10);
      const awayScore = parseInt(String(awayComp.score ?? "0"), 10);

      const broadcasts = (competition.broadcasts as Array<Record<string, unknown>>) ?? [];
      const broadcaster =
        broadcasts.length > 0
          ? String((broadcasts[0].names as string[])?.[0] ?? "")
          : undefined;

      const venueObj = competition.venue as Record<string, unknown> | undefined;
      const venue = venueObj?.fullName ? String(venueObj.fullName) : undefined;

      matches.push({
        id: String(event.id),
        competition: league.name,
        competitionLogo: league.logo,
        homeTeam: String(homeTeamObj?.name ?? homeTeamObj?.displayName ?? ""),
        homeLogo: String(homeTeamObj?.logo ?? (homeTeamObj?.logos as Array<{ href: string }>)?.[0]?.href ?? ""),
        awayTeam: String(awayTeamObj?.name ?? awayTeamObj?.displayName ?? ""),
        awayLogo: String(awayTeamObj?.logo ?? (awayTeamObj?.logos as Array<{ href: string }>)?.[0]?.href ?? ""),
        status,
        elapsed,
        elapsedDisplay,
        homeScore,
        awayScore,
        startTime: String(event.date ?? ""),
        events: [],
        stats: { possession: 50, shotsOnTarget: 0, corners: 0, fouls: 0 },
        broadcasterRecommendation: broadcaster || undefined,
        venue,
        leagueSlug: league.slug,
        homeTeamId: String(homeComp.id ?? ""),
        awayTeamId: String(awayComp.id ?? ""),
      });
    }

    return matches;
  } catch (err) {
    console.error(`[football/route] fetchScoreboardForDate failed for ${league.slug} date=${dateStr ?? "today"}:`, err);
    return [];
  }
}

// Convenience wrapper: today (no date param)
async function fetchScoreboard(league: (typeof LEAGUES)[0]): Promise<RawMatch[]> {
  return fetchScoreboardForDate(league);
}

// Helper: get date string in YYYYMMDD format offset by N days from now
function getDateOffset(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

// ---------------------------------------------------------------------------
// Fetch a single ESPN match summary
// ---------------------------------------------------------------------------
async function fetchSummary(leagueSlug: string, matchId: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(
      `${ESPN_BASE}/${leagueSlug}/summary?event=${matchId}`,
      { headers: ESPN_HEADERS }
    );
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch (err) {
    console.error(`[football/route] fetchSummary failed for ${matchId}:`, err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Fetch dedicated standings for a league
// ---------------------------------------------------------------------------
async function fetchStandings(leagueSlug: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(
      `https://site.api.espn.com/apis/v2/sports/soccer/${leagueSlug}/standings`,
      { headers: ESPN_HEADERS }
    );
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch (err) {
    console.error(`[football/route] fetchStandings failed for ${leagueSlug}:`, err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// GET /api/football
// ---------------------------------------------------------------------------
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const matchId = searchParams.get("matchId");
  const league = searchParams.get("league");

  // If matchId and league are provided, return the full summary (lineups, detailed stats, events)
  if (matchId && league) {
    try {
      const summary = await fetchSummary(league, matchId);
      if (!summary) {
        return NextResponse.json({ error: "Match summary not found" }, { status: 404 });
      }

      // Map statistics
      const boxscoreTeams = (summary.boxscore as any)?.teams;
      
      const getStat = (teamsList: any[], isHome: boolean, name: string): number => {
        const teamObj = teamsList?.find((t: any) => isHome ? t.homeAway === "home" : t.homeAway === "away") || (isHome ? teamsList?.[0] : teamsList?.[1]);
        if (!teamObj?.statistics) return 0;
        const s = teamObj.statistics.find((st: any) => st.name === name);
        if (!s) return 0;
        const raw = s.value ?? parseFloat(s.displayValue ?? "0");
        return isNaN(raw) ? 0 : raw;
      };

      const mapDetailedStats = (teamsList: any[], isHome: boolean) => {
        const totalPassesVal = getStat(teamsList, isHome, "totalPasses") || getStat(teamsList, isHome, "passes");
        const passPctVal = getStat(teamsList, isHome, "passPct") || getStat(teamsList, isHome, "passCompletionPct");
        const passAccuracy = passPctVal <= 1 ? Math.round(passPctVal * 100) : Math.round(passPctVal);

        return {
          possession: Math.round(getStat(teamsList, isHome, "possessionPct")) || 50,
          shots: Math.round(getStat(teamsList, isHome, "totalShots")) || 0,
          shotsOnTarget: Math.round(getStat(teamsList, isHome, "shotsOnTarget")) || 0,
          fouls: Math.round(getStat(teamsList, isHome, "foulsCommitted")) || 0,
          yellowCards: Math.round(getStat(teamsList, isHome, "yellowCards")) || 0,
          redCards: Math.round(getStat(teamsList, isHome, "redCards")) || 0,
          corners: Math.round(getStat(teamsList, isHome, "wonCorners")) || 0,
          passes: Math.round(totalPassesVal) || 0,
          passAccuracy: passAccuracy || 0,
          saves: Math.round(getStat(teamsList, isHome, "saves")) || 0,
        };
      };

      const stats = {
        home: mapDetailedStats(boxscoreTeams, true),
        away: mapDetailedStats(boxscoreTeams, false),
      };

      // Map lineups/rosters
      const rostersData = summary.rosters as any[];
      const mapRoster = (isHome: boolean) => {
        const teamRoster = rostersData?.find((r: any) => isHome ? r.homeAway === "home" : r.homeAway === "away") || (isHome ? rostersData?.[0] : rostersData?.[1]);
        if (!teamRoster) {
          return { formation: "", starters: [], bench: [] };
        }

        const rosterList = Array.isArray(teamRoster.roster) ? teamRoster.roster : [];
        const starters = rosterList
          .filter((p: any) => p.starter === true)
          .map((p: any) => ({
            id: String(p.athlete?.id || ""),
            name: String(p.athlete?.displayName || p.athlete?.fullName || ""),
            jersey: String(p.jersey || ""),
            position: String(p.position?.displayName || p.position?.name || ""),
            formationPlace: p.formationPlace ? String(p.formationPlace) : undefined,
          }))
          .sort((a: any, b: any) => (parseInt(a.formationPlace) || 0) - (parseInt(b.formationPlace) || 0));

        const bench = rosterList
          .filter((p: any) => p.starter !== true)
          .map((p: any) => ({
            id: String(p.athlete?.id || ""),
            name: String(p.athlete?.displayName || p.athlete?.fullName || ""),
            jersey: String(p.jersey || ""),
            position: String(p.position?.displayName || p.position?.name || ""),
          }));

        return {
          formation: String(teamRoster.formation || ""),
          starters,
          bench,
        };
      };

      const lineups = rostersData ? {
        home: mapRoster(true),
        away: mapRoster(false),
      } : undefined;

      // Map events timeline
      const keyEvents = summary.keyEvents as any[] || [];
      const homeTeamId = String((summary.header as any)?.competitions?.[0]?.competitors?.find((c: any) => c.homeAway === "home")?.id || "");
      const awayTeamId = String((summary.header as any)?.competitions?.[0]?.competitors?.find((c: any) => c.homeAway === "away")?.id || "");

      const mappedEvents = keyEvents.map((e: any) => {
        const typeKey = e.type?.type || "";
        let type: "goal" | "card" | "sub" | "info" = "info";
        if (ESPN_EVENT_TYPE_MAP[typeKey] === "goal") type = "goal";
        else if (ESPN_EVENT_TYPE_MAP[typeKey] === "card") type = "card";
        else if (ESPN_EVENT_TYPE_MAP[typeKey] === "sub" || typeKey === "substitution" || typeKey.includes("substitution")) type = "sub";
        
        const clockStr = e.clock?.displayValue || "";
        const minute = parseInt(clockStr.replace("'", "").split("+")[0], 10) || 0;
        
        // Use e.team?.id for reliable team matching, fall back to e.teamId
        const eventTeamId = String(e.team?.id ?? e.teamId ?? "");
        const team: "home" | "away" = eventTeamId === awayTeamId ? "away" : "home";
        
        // Format detail cleanly: only show player names for goals/cards/subs
        let detail = "";
        if (type === "sub") {
          const pIn = e.participants?.[0]?.athlete?.displayName;
          const pOut = e.participants?.[1]?.athlete?.displayName;
          if (pIn && pOut) {
            detail = `${pIn} 🔄 ${pOut}`;
          } else {
            detail = e.shortText || e.text || "";
          }
        } else if (type === "goal" || type === "card") {
          detail = e.participants?.[0]?.athlete?.displayName || e.shortText || e.text || "";
        } else {
          detail = e.text || "";
        }
        
        return {
          minute,
          clockDisplay: clockStr,
          type,
          detail,
          team,
        };
      });

      mappedEvents.sort((a, b) => a.minute - b.minute);

      const venueObj = (summary.gameInfo as any)?.venue;
      const venue = venueObj?.fullName ? String(venueObj.fullName) : undefined;
      const officialsList = (summary.gameInfo as any)?.officials as any[];
      const officials = Array.isArray(officialsList) ? officialsList.map((o: any) => String(o.fullName)) : undefined;

      const detailResponse = {
        id: matchId,
        status: mapStatus((summary.header as any)?.competitions?.[0]?.status),
        elapsedDisplay: getElapsed((summary.header as any)?.competitions?.[0]?.status).elapsedDisplay,
        homeScore: parseInt(String((summary.header as any)?.competitions?.[0]?.competitors?.find((c: any) => c.homeAway === "home")?.score ?? "0"), 10),
        awayScore: parseInt(String((summary.header as any)?.competitions?.[0]?.competitors?.find((c: any) => c.homeAway === "away")?.score ?? "0"), 10),
        venue,
        officials,
        stats,
        events: mappedEvents,
        lineups,
      };

      return NextResponse.json(detailResponse, {
        headers: { "Cache-Control": "no-store" },
      });
    } catch (err) {
      console.error("[football/route] Failed to fetch match details:", err);
      return NextResponse.json({ error: "Failed to fetch match details" }, { status: 502 });
    }
  }

  // Return cached response if still fresh
  const now = Date.now();
  if (cache && now - cache.ts < CACHE_TTL) {
    return NextResponse.json(cache.data, {
      headers: { "Cache-Control": "no-store" },
    });
  }

  try {
    // -----------------------------------------------------------------------
    // Step 1 — Fetch scoreboards: 2 days back + today + 2 days forward
    //   Past days ensure recent results (e.g. FIFA World Cup) are visible.
    //   Future days ensure upcoming fixtures are captured.
    // -----------------------------------------------------------------------
    const dayBeforeYesterday = getDateOffset(-2);
    const yesterday = getDateOffset(-1);
    const tomorrow = getDateOffset(1);
    const dayAfter = getDateOffset(2);

    const [
      dayBeforeYesterdayResults,
      yesterdayResults,
      todayResults,
      tomorrowResults,
      dayAfterResults,
    ] = await Promise.all([
      Promise.all(LEAGUES.map((l) => fetchScoreboardForDate(l, dayBeforeYesterday))),
      Promise.all(LEAGUES.map((l) => fetchScoreboardForDate(l, yesterday))),
      Promise.all(LEAGUES.map(fetchScoreboard)),
      Promise.all(LEAGUES.map((l) => fetchScoreboardForDate(l, tomorrow))),
      Promise.all(LEAGUES.map((l) => fetchScoreboardForDate(l, dayAfter))),
    ]);

    // Merge and deduplicate by match ID (today takes priority, then outward)
    const seenMatchIds = new Set<string>();
    const allMatches: RawMatch[] = [];
    for (const m of [
      ...todayResults.flat(),
      ...yesterdayResults.flat(),
      ...dayBeforeYesterdayResults.flat(),
      ...tomorrowResults.flat(),
      ...dayAfterResults.flat(),
    ]) {
      if (!seenMatchIds.has(m.id)) {
        seenMatchIds.add(m.id);
        allMatches.push(m);
      }
    }

    // -----------------------------------------------------------------------
    // Step 2 — Determine which matches need summaries
    // -----------------------------------------------------------------------
    const prioritised: RawMatch[] = [];
    const seenIds = new Set<string>();

    for (const m of allMatches) {
      if ((m.status === "LIVE" || m.status === "HT") && !seenIds.has(m.id)) {
        prioritised.push(m);
        seenIds.add(m.id);
      }
    }

    const standingsRepresentative: Record<string, RawMatch> = {};
    for (const m of allMatches) {
      if (
        (m.status === "FT" || m.status === "LIVE" || m.status === "HT") &&
        !standingsRepresentative[m.leagueSlug]
      ) {
        standingsRepresentative[m.leagueSlug] = m;
        if (!seenIds.has(m.id)) {
          prioritised.push(m);
          seenIds.add(m.id);
        }
      }
    }

    const summaryBatch = prioritised.slice(0, 10);

    // -----------------------------------------------------------------------
    // Step 3 — Fetch summaries concurrently (rate-limited to 10)
    // -----------------------------------------------------------------------
    const summaryResults = await Promise.all(
      summaryBatch.map((m) =>
        fetchSummary(m.leagueSlug, m.id).then((summary) => ({
          id: m.id,
          summary,
        }))
      )
    );

    const summaryMap = new Map(
      summaryResults
        .filter((r) => r.summary !== null)
        .map((r) => [r.id, r.summary as Record<string, unknown>])
    );

    // -----------------------------------------------------------------------
    // Step 4 — Enrich matches with summary data (events + stats)
    // -----------------------------------------------------------------------
    const enrichedMatches: Match[] = allMatches.map((match) => {
      const { homeTeamId, awayTeamId, ...publicMatch } = match;
      const summary = summaryMap.get(match.id);

      if (!summary) return publicMatch;

      const keyEvents = summary.keyEvents as
        | Array<{
            type?: { type?: string };
            clock?: { displayValue?: string };
            text?: string;
            teamId?: string | number;
            participants?: string[];
          }>
        | undefined;

      const events: MatchEvent[] = keyEvents
        ? mapKeyEvents(keyEvents, homeTeamId, awayTeamId)
        : [];

      const boxscoreTeams = (
        summary.boxscore as { teams?: Array<Record<string, unknown>> } | undefined
      )?.teams;

      const stats: MatchStats = boxscoreTeams
        ? mapStats(
            boxscoreTeams as Parameters<typeof mapStats>[0],
            publicMatch.homeTeam
          )
        : publicMatch.stats;

      return { ...publicMatch, events, stats };
    });

    // -----------------------------------------------------------------------
    // Step 5 — Fetch and build standings from dedicated standings endpoints
    // -----------------------------------------------------------------------
    const standingsResults = await Promise.all(
      LEAGUES.map((l) =>
        fetchStandings(l.slug).then((data) => ({
          leagueName: l.name,
          data,
        }))
      )
    );

    const standings: CompetitionStandings[] = [];
    for (const item of standingsResults) {
      if (item.data) {
        const groups = mapStandings(item.data, item.leagueName);
        standings.push(...groups);
      }
    }

    // -----------------------------------------------------------------------
    // Step 6 — Cache and return
    // -----------------------------------------------------------------------
    const result = { matches: enrichedMatches, standings };
    cache = { data: result, ts: now };

    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("[football/route] Fatal error:", err);
    if (cache) {
      return NextResponse.json(cache.data, {
        headers: { "Cache-Control": "no-store" },
      });
    }
    return NextResponse.json(
      { error: "Failed to fetch football data. Please try again shortly." },
      { status: 502 }
    );
  }
}
