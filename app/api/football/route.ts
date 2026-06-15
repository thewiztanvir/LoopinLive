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
    participants?: string[];
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

    const eventTeamId = String(e.teamId ?? "");
    // If teamId matches awayTeamId → away; otherwise default home
    const team: "home" | "away" =
      eventTeamId === String(awayTeamId) ? "away" : "home";

    const detail = e.text || (Array.isArray(e.participants) ? e.participants[0] : "") || "";

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
  summaryStandings: {
    groups?: Array<{
      standings?: {
        entries?: Array<{
          team?: string;
          logo?: Array<{ href?: string }>;
          stats?: Array<{ name: string; value?: number; displayValue?: string }>;
        }>;
      };
    }>;
  },
  leagueName: string
): CompetitionStandings | null {
  try {
    const entries =
      summaryStandings?.groups?.[0]?.standings?.entries ?? [];
    if (entries.length === 0) return null;

    const table: StandingTeam[] = entries.map((entry, i) => {
      const stats = entry.stats ?? [];

      const getStat = (name: string): number => {
        const s = stats.find((s) => s.name === name);
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

      // Logo is a separate array on the entry (confirmed from API)
      const logo = Array.isArray(entry.logo) ? (entry.logo[0]?.href ?? "") : "";

      return {
        position: rank,
        name: entry.team ?? "",      // team is a plain string
        logo,
        played,
        won,
        drawn,
        lost,
        points,
        goalsFor: 0,               // not available from this endpoint
        goalsAgainst: 0,
        goalDifference: gd,
        form: [] as ("W" | "D" | "L")[],
      };
    });

    // Sort by position (rank) ascending
    table.sort((a, b) => a.position - b.position);
    return { competition: leagueName, table };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Fetch a single ESPN scoreboard and return raw match objects
// ---------------------------------------------------------------------------
async function fetchScoreboard(league: (typeof LEAGUES)[0]): Promise<RawMatch[]> {
  try {
    const res = await fetch(`${ESPN_BASE}/${league.slug}/scoreboard`, {
      headers: ESPN_HEADERS,
      // Next.js revalidation: refresh every 30s on the CDN layer too
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

      // score field is a STRING on ESPN competitors — CONFIRMED
      const homeScore = parseInt(String(homeComp.score ?? "0"), 10);
      const awayScore = parseInt(String(awayComp.score ?? "0"), 10);

      // Broadcaster info (optional — not always present)
      const broadcasts = (competition.broadcasts as Array<Record<string, unknown>>) ?? [];
      const broadcaster =
        broadcasts.length > 0
          ? String((broadcasts[0].names as string[])?.[0] ?? "")
          : undefined;

      matches.push({
        id: String(event.id),
        competition: league.name,
        competitionLogo: league.logo,
        homeTeam: String(homeTeamObj?.name ?? homeTeamObj?.displayName ?? ""),
        // team.logo is a direct URL on the scoreboard competitor (confirmed)
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
        // Internal fields for enrichment
        leagueSlug: league.slug,
        homeTeamId: String(homeComp.id ?? ""),
        awayTeamId: String(awayComp.id ?? ""),
      });
    }

    return matches;
  } catch (err) {
    console.error(`[football/route] fetchScoreboard failed for ${league.slug}:`, err);
    return [];
  }
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
// GET /api/football
// ---------------------------------------------------------------------------
export async function GET() {
  // Return cached response if still fresh
  const now = Date.now();
  if (cache && now - cache.ts < CACHE_TTL) {
    return NextResponse.json(cache.data, {
      headers: { "Cache-Control": "no-store" },
    });
  }

  try {
    // -----------------------------------------------------------------------
    // Step 1 — Fetch all 7 league scoreboards concurrently
    // -----------------------------------------------------------------------
    const scoreboardResults = await Promise.all(LEAGUES.map(fetchScoreboard));
    const allMatches: RawMatch[] = scoreboardResults.flat();

    // -----------------------------------------------------------------------
    // Step 2 — Determine which matches need summaries
    //   • LIVE/HT  → need for live stats + events
    //   • FT       → use one per league for standings
    //   • SCHEDULED → no summary needed
    //   Cap at 10 concurrent summary fetches to respect ESPN's servers
    // -----------------------------------------------------------------------
    const prioritised: RawMatch[] = [];
    const seenIds = new Set<string>();

    // First pass: LIVE/HT matches (most important — real-time data)
    for (const m of allMatches) {
      if ((m.status === "LIVE" || m.status === "HT") && !seenIds.has(m.id)) {
        prioritised.push(m);
        seenIds.add(m.id);
      }
    }

    // Second pass: one FT match per league for standings
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

    // Limit to 10 concurrent summary requests
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
      const { leagueSlug, homeTeamId, awayTeamId, ...publicMatch } = match;
      const summary = summaryMap.get(match.id);

      if (!summary) return publicMatch;

      // Map key events
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

      // Map boxscore stats
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
    // Step 5 — Build standings from summary data
    // Only leagues that had a FT/LIVE match get standings
    // -----------------------------------------------------------------------
    const standings: CompetitionStandings[] = [];
    const seenStandingsLeagues = new Set<string>();

    for (const [slug, repMatch] of Object.entries(standingsRepresentative)) {
      if (seenStandingsLeagues.has(slug)) continue;

      const summary = summaryMap.get(repMatch.id);
      if (!summary?.standings) continue;

      const s = mapStandings(
        summary.standings as Parameters<typeof mapStandings>[0],
        repMatch.competition
      );

      if (s && s.table.length > 0) {
        standings.push(s);
        seenStandingsLeagues.add(slug);
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
    // Return cached data (even if stale) as fallback rather than a hard error
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
