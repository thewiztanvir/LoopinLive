import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 25;

// ---------------------------------------------------------------------------
// ESPN API Configuration
// ---------------------------------------------------------------------------
// `site.api.espn.com` rejects requests from Netlify's serverless network.
// `site.web.api.espn.com` exposes the same public ESPN payloads and is
// reachable from both Netlify and local development.
const ESPN_BASE = "https://site.web.api.espn.com/apis/site/v2/sports/soccer";

// Must include browser-like headers; ESPN blocks bare Node.js requests
const ESPN_HEADERS: Record<string, string> = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
};

// Per-request timeout (ms) — keeps Netlify serverless under its 10s limit
const FETCH_TIMEOUT_MS = 6000;

// Wraps fetch() with an AbortController timeout so ESPN slow/blocked
// responses don't hang the whole serverless function.
async function fetchWithTimeout(url: string, options?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

// ---------------------------------------------------------------------------
// League catalogue — domestic + European competitions
// ---------------------------------------------------------------------------
const DOMESTIC_LEAGUES = [
  {
    slug: "eng.1",
    name: "Premier League",
    logo: "https://a.espncdn.com/i/leaguelogos/soccer/500/23.png",
    category: "domestic" as const,
  },
  {
    slug: "esp.1",
    name: "La Liga",
    logo: "https://a.espncdn.com/i/leaguelogos/soccer/500/87.png",
    category: "domestic" as const,
  },
  {
    slug: "ger.1",
    name: "Bundesliga",
    logo: "https://a.espncdn.com/i/leaguelogos/soccer/500/10.png",
    category: "domestic" as const,
  },
  {
    slug: "ita.1",
    name: "Serie A",
    logo: "https://a.espncdn.com/i/leaguelogos/soccer/500/55.png",
    category: "domestic" as const,
  },
  {
    slug: "fra.1",
    name: "Ligue 1",
    logo: "https://a.espncdn.com/i/leaguelogos/soccer/500/9.png",
    category: "domestic" as const,
  },
  {
    slug: "por.1",
    name: "Primeira Liga",
    logo: "https://a.espncdn.com/i/leaguelogos/soccer/500/84.png",
    category: "domestic" as const,
  },
  {
    slug: "ned.1",
    name: "Eredivisie",
    logo: "https://a.espncdn.com/i/leaguelogos/soccer/500/11.png",
    category: "domestic" as const,
  },
  {
    slug: "eng.2",
    name: "Championship",
    logo: "https://a.espncdn.com/i/leaguelogos/soccer/500/24.png",
    category: "domestic" as const,
  },
  {
    slug: "usa.1",
    name: "MLS",
    logo: "https://a.espncdn.com/i/leaguelogos/soccer/500/19.png",
    category: "domestic" as const,
  },
];

const EUROPEAN_LEAGUES = [
  {
    slug: "uefa.champions",
    name: "Champions League",
    logo: "https://a.espncdn.com/i/leaguelogos/soccer/500/2.png",
    category: "european" as const,
  },
  {
    slug: "uefa.europa",
    name: "Europa League",
    logo: "https://a.espncdn.com/i/leaguelogos/soccer/500/2572.png",
    category: "european" as const,
  },
  {
    slug: "uefa.europac",
    name: "Conference League",
    logo: "https://a.espncdn.com/i/leaguelogos/soccer/500/2975.png",
    category: "european" as const,
  },
];

// International competitions — WC Qualifiers, Nations Leagues, continental cups
// These return empty arrays when not active — no disruption to the UI
const INTERNATIONAL_LEAGUES = [
  {
    slug: "fifa.worldq.uefa",
    name: "UEFA WC Qualifiers",
    logo: "https://a.espncdn.com/i/leaguelogos/soccer/500/4.png",
    category: "international" as const,
  },
  {
    slug: "fifa.worldq.concacaf",
    name: "CONCACAF WC Qualifiers",
    logo: "https://a.espncdn.com/i/leaguelogos/soccer/500/4.png",
    category: "international" as const,
  },
  {
    slug: "fifa.worldq.conmebol",
    name: "CONMEBOL WC Qualifiers",
    logo: "https://a.espncdn.com/i/leaguelogos/soccer/500/4.png",
    category: "international" as const,
  },
  {
    slug: "fifa.worldq.afc",
    name: "AFC WC Qualifiers",
    logo: "https://a.espncdn.com/i/leaguelogos/soccer/500/4.png",
    category: "international" as const,
  },
  {
    slug: "fifa.worldq.caf",
    name: "CAF WC Qualifiers",
    logo: "https://a.espncdn.com/i/leaguelogos/soccer/500/4.png",
    category: "international" as const,
  },
  {
    slug: "fifa.worldq.ofc",
    name: "OFC WC Qualifiers",
    logo: "https://a.espncdn.com/i/leaguelogos/soccer/500/4.png",
    category: "international" as const,
  },
  {
    slug: "uefa.nations",
    name: "UEFA Nations League",
    logo: "https://a.espncdn.com/i/leaguelogos/soccer/500/2.png",
    category: "international" as const,
  },
  {
    slug: "concacaf.nations.league",
    name: "CONCACAF Nations League",
    logo: "https://a.espncdn.com/i/leaguelogos/soccer/500/65.png",
    category: "international" as const,
  },
  {
    slug: "conmebol.copa_america",
    name: "Copa América",
    logo: "https://a.espncdn.com/i/leaguelogos/soccer/500/22.png",
    category: "international" as const,
  },
  {
    slug: "afc.asian_cup",
    name: "AFC Asian Cup",
    logo: "https://a.espncdn.com/i/leaguelogos/soccer/500/100.png",
    category: "international" as const,
  },
  {
    slug: "caf.afcon",
    name: "AFCON",
    logo: "https://a.espncdn.com/i/leaguelogos/soccer/500/100.png",
    category: "international" as const,
  },
  {
    slug: "uefa.euro",
    name: "UEFA European Championship",
    logo: "https://a.espncdn.com/i/leaguelogos/soccer/500/2.png",
    category: "international" as const,
  },
  {
    slug: "fifa.friendly.m",
    name: "International Friendlies",
    logo: "https://a.espncdn.com/i/leaguelogos/soccer/500/4.png",
    category: "international" as const,
  },
];

type League =
  | (typeof DOMESTIC_LEAGUES)[number]
  | (typeof EUROPEAN_LEAGUES)[number]
  | (typeof INTERNATIONAL_LEAGUES)[number];

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
  leagueCategory: "domestic" | "european" | "international";
  isKnockout?: boolean;
  roundName?: string;
  homePenaltyScore?: number;
  awayPenaltyScore?: number;
  homeWinner?: boolean;
  awayWinner?: boolean;
  homeAdvance?: boolean;
  awayAdvance?: boolean;
  /** 1 for first leg, 2 for second leg, undefined for single-leg ties */
  legNumber?: number;
  /** Shared key linking both legs of the same tie (sorted team IDs) */
  tieId?: string;
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
// Helper: determine if a round name represents a true knockout bracket round.
// Must NOT fire for league-phase names like "League Stage", "Regular Season",
// "Group Stage", etc. Only fires for genuine bracket rounds.
// ---------------------------------------------------------------------------
function isKnockoutRound(roundName: string | undefined): boolean {
  if (!roundName) return false;
  const l = roundName.toLowerCase();
  // Exclude league / group phases explicitly
  if (
    l.includes("group") ||
    l.includes("league stage") ||
    l.includes("league phase") ||
    l.includes("regular season") ||
    l.includes("season") ||
    l.includes("matchday") ||
    l.includes("match day")
  ) return false;
  // Only true bracket rounds
  return (
    l.includes("round of") ||
    l.includes("quarter") ||
    l.includes("semi") ||
    l.includes("final") ||
    l.includes("knockout") ||
    l.includes("last 16") ||
    l.includes("last 32") ||
    l.includes("last 64") ||
    l.includes("playoff") ||
    l.includes("play-off") ||
    l.includes("elimination") ||
    /\br(16|32|64|128)\b/.test(l)
  );
}

// ---------------------------------------------------------------------------
// Helper: parse leg number (1 or 2) from ESPN notes array text.
// ESPN sometimes includes "1st Leg" / "2nd Leg" in competition.notes.
// ---------------------------------------------------------------------------
function parseLegNumber(notes: Array<{ type?: string; text?: string }> | undefined): number | undefined {
  if (!Array.isArray(notes)) return undefined;
  for (const note of notes) {
    const t = (note.text || "").toLowerCase();
    if (t.includes("1st leg") || t.includes("first leg")) return 1;
    if (t.includes("2nd leg") || t.includes("second leg")) return 2;
  }
  return undefined;
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
    const minute = parseInt(clockStr.replace("'", "").split("+")[0], 10) || 0;

    const eventTeamId = String(e.team?.id ?? e.teamId ?? "");
    const team: "home" | "away" =
      eventTeamId === String(awayTeamId) ? "away" : "home";

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

  return events.sort((a, b) => a.minute - b.minute);
}

// ---------------------------------------------------------------------------
// Map ESPN boxscore teams → our MatchStats
// ---------------------------------------------------------------------------
function mapStats(
  boxscoreTeams: Array<{
    team?: { name?: string; displayName?: string };
    statistics?: Array<{ name: string; value?: number; displayValue?: string }>;
  }>,
  homeTeamName: string
): MatchStats {
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
// Tries multiple stat name variants to handle ESPN's inconsistency across leagues
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

        // Try multiple stat name variants (ESPN is inconsistent across leagues)
        const getStat = (...names: string[]): number => {
          for (const name of names) {
            const s = stats.find((s: any) => s.name === name);
            if (s) {
              const v = s.value ?? parseFloat(s.displayValue ?? "0");
              const n = Number(v);
              if (!isNaN(n)) return n;
            }
          }
          return 0;
        };

        const rank = getStat("rank") || i + 1;
        const won = getStat("wins");
        const lost = getStat("losses");
        const drawn = getStat("ties");
        const played = getStat("gamesPlayed");
        const points = getStat("points");
        // ESPN uses different stat names across leagues: pointDifferential, goalDifference, GD
        const gd = getStat("pointDifferential", "goalDifference", "GD");
        // Goals For / Against: ESPN uses various names
        const goalsFor = getStat("pointsFor", "goalsFor", "GF", "goals");
        const goalsAgainst = getStat("pointsAgainst", "goalsAgainst", "GA");

        // Resolve logo
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
          goalsFor,
          goalsAgainst,
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
// Fetch a single ESPN scoreboard for a specific date (YYYYMMDD)
// ---------------------------------------------------------------------------
async function fetchScoreboardForDate(
  league: League,
  dateStr?: string
): Promise<RawMatch[]> {
  try {
    const url = dateStr
      ? `${ESPN_BASE}/${league.slug}/scoreboard?dates=${dateStr}`
      : `${ESPN_BASE}/${league.slug}/scoreboard`;
    const res = await fetchWithTimeout(url, {
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

      const seasonObj = (event.season as any);
      let roundName: string | undefined = undefined;
      if (seasonObj?.type?.name) {
        roundName = String(seasonObj.type.name);
      } else if (seasonObj?.slug) {
        roundName = String(seasonObj.slug).replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
      }

      const isKnockout = isKnockoutRound(roundName);

      // Parse leg number from competition notes (ESPN includes "1st Leg" / "2nd Leg" here)
      const competitionNotes = competition.notes as Array<{ type?: string; text?: string }> | undefined;
      const legNumber = parseLegNumber(competitionNotes);

      const homeTeamIdStr = String(homeComp.id ?? homeTeamObj?.id ?? "");
      const awayTeamIdStr = String(awayComp.id ?? awayTeamObj?.id ?? "");

      // tieId: stable key shared by both legs of the same two-legged tie
      // Built from sorted team IDs so leg1 and leg2 produce identical keys
      const tieId = legNumber !== undefined
        ? [homeTeamIdStr, awayTeamIdStr].sort().join("-")
        : undefined;

      const homePenaltyScore = homeComp.shootoutScore !== undefined ? parseInt(String(homeComp.shootoutScore), 10) : undefined;
      const awayPenaltyScore = awayComp.shootoutScore !== undefined ? parseInt(String(awayComp.shootoutScore), 10) : undefined;
      const homeWinner = homeComp.winner as boolean | undefined;
      const awayWinner = awayComp.winner as boolean | undefined;
      const homeAdvance = homeComp.advance as boolean | undefined;
      const awayAdvance = awayComp.advance as boolean | undefined;

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
        leagueCategory: league.category,
        homeTeamId: homeTeamIdStr,
        awayTeamId: awayTeamIdStr,
        isKnockout,
        roundName,
        homePenaltyScore,
        awayPenaltyScore,
        homeWinner,
        awayWinner,
        homeAdvance,
        awayAdvance,
        legNumber,
        tieId,
      });
    }

    return matches;
  } catch (err) {
    console.error(`[football/route] fetchScoreboardForDate failed for ${league.slug} date=${dateStr ?? "today"}:`, err);
    return [];
  }
}

// Helper: get date string in YYYYMMDD format offset by N days from now
// Uses a safe manual offset for Asia/Dhaka (+6 hours) to avoid Intl ICU data crashes on Netlify
function getDateOffset(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  d.setHours(d.getUTCHours() + 6); // Dhaka is UTC+6
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}${mm}${dd}`;
}

// ---------------------------------------------------------------------------
// Fetch a single ESPN match summary
// ---------------------------------------------------------------------------
async function fetchSummary(leagueSlug: string, matchId: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetchWithTimeout(
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
    const res = await fetchWithTimeout(
      `https://site.web.api.espn.com/apis/v2/sports/soccer/${leagueSlug}/standings`,
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

  // If matchId and league are provided, return the full summary
  if (matchId && league) {
    try {
      const summary = await fetchSummary(league, matchId);
      if (!summary) {
        return NextResponse.json({ error: "Match summary not found" }, { status: 404 });
      }

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

      const keyEvents = summary.keyEvents as any[] || [];
      const getTeamId = (c: any) => c?.team?.id ?? c?.id ?? "";
      const homeTeamId = String(getTeamId((summary.header as any)?.competitions?.[0]?.competitors?.find((c: any) => c.homeAway === "home")));
      const awayTeamId = String(getTeamId((summary.header as any)?.competitions?.[0]?.competitors?.find((c: any) => c.homeAway === "away")));

      const mappedEvents = keyEvents.map((e: any) => {
        const typeKey = (e.type?.type || "").toLowerCase();
        let type: "goal" | "card" | "sub" | "info" = "info";
        if (typeKey.includes("goal") || ESPN_EVENT_TYPE_MAP[typeKey] === "goal") type = "goal";
        else if (typeKey.includes("card") || ESPN_EVENT_TYPE_MAP[typeKey] === "card") type = "card";
        else if (typeKey.includes("sub") || typeKey.includes("substitution") || ESPN_EVENT_TYPE_MAP[typeKey] === "sub") type = "sub";
        
        const clockStr = e.clock?.displayValue || "";
        const minute = parseInt(clockStr.replace("'", "").split("+")[0], 10) || 0;
        
        const eventTeamId = String(e.team?.id ?? e.teamId ?? "");
        const team: "home" | "away" = eventTeamId === awayTeamId ? "away" : "home";
        
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

      const homeCompetitor = (summary.header as any)?.competitions?.[0]?.competitors?.find((c: any) => c.homeAway === "home");
      const awayCompetitor = (summary.header as any)?.competitions?.[0]?.competitors?.find((c: any) => c.homeAway === "away");
      const seasonObj = (summary.header as any)?.season;
      let roundName: string | undefined = undefined;
      if (seasonObj?.type?.name) {
        roundName = String(seasonObj.type.name);
      } else if (seasonObj?.slug) {
        roundName = String(seasonObj.slug).replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
      }
      
      const isKnockout = !!roundName && !roundName.toLowerCase().includes("group");
      const homePenaltyScore = homeCompetitor?.shootoutScore !== undefined ? parseInt(String(homeCompetitor.shootoutScore), 10) : undefined;
      const awayPenaltyScore = awayCompetitor?.shootoutScore !== undefined ? parseInt(String(awayCompetitor.shootoutScore), 10) : undefined;
      const homeWinner = homeCompetitor?.winner;
      const awayWinner = awayCompetitor?.winner;
      const homeAdvance = homeCompetitor?.advance;
      const awayAdvance = awayCompetitor?.advance;

      const detailResponse = {
        id: matchId,
        status: mapStatus((summary.header as any)?.competitions?.[0]?.status),
        elapsedDisplay: getElapsed((summary.header as any)?.competitions?.[0]?.status).elapsedDisplay,
        homeScore: parseInt(String(homeCompetitor?.score ?? "0"), 10),
        awayScore: parseInt(String(awayCompetitor?.score ?? "0"), 10),
        venue,
        officials,
        stats,
        events: mappedEvents,
        lineups,
        isKnockout,
        roundName,
        homePenaltyScore,
        awayPenaltyScore,
        homeWinner,
        awayWinner,
        homeAdvance,
        awayAdvance,
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
    // Step 1 — Fetch scoreboards: using a date range!
    //   We fetch past 2 days to get recent results.
    //   We fetch up to 30 days forward for club leagues to ensure we see schedules
    //   for leagues that haven't started yet (e.g. Premier League in early August).
    //   International leagues get a shorter 14-day window.
    // -----------------------------------------------------------------------
    // Keep date ranges tight to reduce response size and avoid Netlify timeouts
    const dateRangeClub = `${getDateOffset(-3)}-${getDateOffset(7)}`;
    const dateRangeIntl = `${getDateOffset(-3)}-${getDateOffset(7)}`;

    const clubLeagues = [...DOMESTIC_LEAGUES, ...EUROPEAN_LEAGUES];
    const standingsPromise = Promise.all(
      clubLeagues.map((l) =>
        fetchStandings(l.slug).then((data) => ({ leagueName: l.name, data }))
      )
    );

    const [clubResults, intlResults] = await Promise.all([
      Promise.all(clubLeagues.map((l) => fetchScoreboardForDate(l, dateRangeClub))),
      Promise.all(INTERNATIONAL_LEAGUES.map((l) => fetchScoreboardForDate(l, dateRangeIntl))),
    ]);

    // Merge and deduplicate by match ID
    const seenMatchIds = new Set<string>();
    const allMatches: RawMatch[] = [];
    for (const m of [
      ...clubResults.flat(),
      ...intlResults.flat(),
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

    // Full summaries are loaded on demand in the match dialog. Keeping them
    // out of the initial listing prevents a second slow network batch from
    // exhausting Netlify's request duration.
    const summaryBatch: RawMatch[] = [];

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
    //          Always fetch for domestic and european leagues so their tables
    //          are visible even when they have no matches this week.
    //          For international cups, only fetch if they have matches.
    // -----------------------------------------------------------------------
    const standingsResults = await standingsPromise;

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
