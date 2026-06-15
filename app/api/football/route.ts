import { NextResponse } from "next/server";

// Simple in-memory cache for API proxy requests (to prevent rate limits if keys are used)
let cachedData: any = null;
let cacheTime: number = 0;
const CACHE_DURATION_MS = 30000; // 30 seconds for matches

interface MatchEvent {
  minute: number;
  type: "goal" | "card" | "sub";
  detail: string;
  team: "home" | "away";
}

interface TeamStats {
  possession: number; // percentage
  shotsOnTarget: number;
  corners: number;
  fouls: number;
}

interface Match {
  id: string;
  competition: string;
  competitionLogo: string;
  homeTeam: string;
  homeLogo: string;
  awayTeam: string;
  awayLogo: string;
  status: "LIVE" | "HT" | "FT" | "SCHEDULED";
  elapsed: number; // minutes
  elapsedDisplay: string;
  homeScore: number;
  awayScore: number;
  startTime: string; // ISO String
  events: MatchEvent[];
  stats: TeamStats;
  broadcasterRecommendation?: string;
}

// Standings interface
interface StandingTeam {
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

interface CompetitionStandings {
  competition: string;
  table: StandingTeam[];
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "all"; // "matches" or "standings"
    
    // Check for API Keys in environment variables
    const apiKey = process.env.FOOTBALL_API_KEY;
    const apiProvider = process.env.FOOTBALL_API_PROVIDER || "football-data";

    if (apiKey && type === "matches") {
      const now = Date.now();
      if (cachedData && now - cacheTime < CACHE_DURATION_MS) {
        return NextResponse.json(cachedData);
      }
      
      try {
        // Fetch from Football-Data.org
        const response = await fetch("https://api.football-data.org/v4/matches", {
          headers: {
            "X-Auth-Token": apiKey,
          },
          next: { revalidate: 30 },
        });

        if (response.ok) {
          const data = await response.json();
          const mappedMatches = data.matches.map((m: any) => {
            const statusMap: Record<string, Match["status"]> = {
              IN_PLAY: "LIVE",
              PAUSED: "HT",
              FINISHED: "FT",
              TIMED: "SCHEDULED",
              SCHEDULED: "SCHEDULED",
            };
            
            return {
              id: String(m.id),
              competition: m.competition.name,
              competitionLogo: m.competition.emblem || "",
              homeTeam: m.homeTeam.name,
              homeLogo: m.homeTeam.crest || "",
              awayTeam: m.awayTeam.name,
              awayLogo: m.awayTeam.crest || "",
              status: statusMap[m.status] || "SCHEDULED",
              elapsed: m.score?.fullTime?.home !== null ? 45 : 0, // Fallback
              elapsedDisplay: m.status === "IN_PLAY" ? "LIVE" : m.status === "PAUSED" ? "HT" : m.status === "FINISHED" ? "FT" : "",
              homeScore: m.score?.fullTime?.home ?? 0,
              awayScore: m.score?.fullTime?.away ?? 0,
              startTime: m.utcDate,
              events: [],
              stats: {
                possession: 50,
                shotsOnTarget: 5,
                corners: 4,
                fouls: 10
              }
            };
          });

          cachedData = { matches: mappedMatches, standings: getMockStandings() };
          cacheTime = now;
          return NextResponse.json(cachedData);
        }
      } catch (err) {
        console.error("External API error, falling back to rich simulation:", err);
      }
    }

    // Default Rich Mock Simulation (Deterministic based on system time)
    const simulatedMatches = getSimulatedMatches();
    const standings = getMockStandings();

    return NextResponse.json(
      { matches: simulatedMatches, standings },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error("Error in football API route:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// Deterministic mock match generator that updates live scores based on server time
function getSimulatedMatches(): Match[] {
  const now = Date.now();

  // Create starting times relative to now (in milliseconds)
  // Match 1: Arsenal vs Chelsea (EPL) - Started 42 minutes ago (LIVE, 1st half)
  const timeM1 = now - 42 * 60 * 1000;
  
  // Match 2: Real Madrid vs Barcelona (La Liga) - Started 76 minutes ago (LIVE, 2nd half - since HT is 45-60)
  const timeM2 = now - 76 * 60 * 1000;

  // Match 3: Bayern Munich vs Dortmund (Bundesliga) - Started 12 minutes ago (LIVE, 1st half)
  const timeM3 = now - 12 * 60 * 1000;

  // Match 4: Man City vs Real Madrid (UCL) - Completed 3 hours ago (FT)
  const timeM4 = now - 3.5 * 60 * 60 * 1000;

  // Match 5: Juventus vs AC Milan (Serie A) - Starts in 2.5 hours (SCHEDULED)
  const timeM5 = now + 2.5 * 60 * 60 * 1000;

  // Match 6: PSG vs Marseille (Ligue 1) - Completed 1.5 days ago (FT)
  const timeM6 = now - 36 * 60 * 60 * 1000;

  // Match 7: Argentina vs France (World Cup Group Stage) - Started 103 minutes ago (LIVE, late 2nd half)
  const timeM7 = now - 103 * 60 * 1000;

  // Match 8: England vs Germany (Int. Friendly) - Starts in 45 minutes (SCHEDULED)
  const timeM8 = now + 45 * 60 * 1000;

  const rawMatches = [
    {
      id: "sim-match-1",
      competition: "English Premier League",
      competitionLogo: "https://upload.wikimedia.org/wikipedia/en/thumb/f/f2/Premier_League_Logo.svg/200px-Premier_League_Logo.svg.png",
      homeTeam: "Arsenal",
      homeLogo: "https://upload.wikimedia.org/wikipedia/en/thumb/5/53/Arsenal_FC.svg/180px-Arsenal_FC.svg.png",
      awayTeam: "Chelsea",
      awayLogo: "https://upload.wikimedia.org/wikipedia/en/thumb/c/cc/Chelsea_FC.svg/180px-Chelsea_FC.svg.png",
      startTime: new Date(timeM1).toISOString(),
      broadcasterRecommendation: "T Sports",
      seeds: { home: 3, away: 7, pos: 54, shtH: 8, shtA: 5, crnH: 6, crnA: 4, flH: 9, flA: 11 },
      allEvents: [
        { minute: 8, type: "card", detail: "Yellow Card: Enzo Fernández (Chelsea)", team: "away" },
        { minute: 19, type: "goal", detail: "Goal! Bukayo Saka (Arsenal) - Assist: Martin Ødegaard", team: "home" },
        { minute: 34, type: "card", detail: "Yellow Card: Gabriel Magalhães (Arsenal)", team: "home" },
        { minute: 40, type: "sub", detail: "Sub: Nicolas Jackson off, Christopher Nkunku on", team: "away" },
        { minute: 62, type: "goal", detail: "Goal! Cole Palmer (Chelsea) - Penalty", team: "away" },
        { minute: 75, type: "goal", detail: "Goal! Kai Havertz (Arsenal) - Header from corner", team: "home" },
        { minute: 88, type: "card", detail: "Yellow Card: Declan Rice (Arsenal)", team: "home" }
      ] as MatchEvent[]
    },
    {
      id: "sim-match-2",
      competition: "La Liga",
      competitionLogo: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0f/LaLiga_logo_2023.svg/200px-LaLiga_logo_2023.svg.png",
      homeTeam: "Real Madrid",
      homeLogo: "https://upload.wikimedia.org/wikipedia/en/thumb/5/56/Real_Madrid_CF.svg/150px-Real_Madrid_CF.svg.png",
      awayTeam: "Barcelona",
      awayLogo: "https://upload.wikimedia.org/wikipedia/en/thumb/4/47/FC_Barcelona.svg/180px-FC_Barcelona.svg.png",
      startTime: new Date(timeM2).toISOString(),
      broadcasterRecommendation: "Somoy TV",
      seeds: { home: 4, away: 2, pos: 43, shtH: 11, shtA: 9, crnH: 4, crnA: 7, flH: 12, flA: 8 },
      allEvents: [
        { minute: 10, type: "goal", detail: "Goal! Robert Lewandowski (Barcelona) - Tap-in", team: "away" },
        { minute: 28, type: "card", detail: "Yellow Card: Dani Carvajal (Real Madrid)", team: "home" },
        { minute: 36, type: "goal", detail: "Goal! Vinícius Júnior (Real Madrid) - Individual run", team: "home" },
        { minute: 51, type: "goal", detail: "Goal! Jude Bellingham (Real Madrid) - Assist: Rodrygo", team: "home" },
        { minute: 60, type: "sub", detail: "Sub: Pedri off, Gavi on", team: "away" },
        { minute: 67, type: "card", detail: "Yellow Card: Ronald Araújo (Barcelona)", team: "away" },
        { minute: 70, type: "goal", detail: "Goal! Lamine Yamal (Barcelona) - Outside-box curler", team: "away" },
        { minute: 82, type: "sub", detail: "Sub: Toni Kroos off, Luka Modrić on", team: "home" },
        { minute: 89, type: "goal", detail: "Goal! Kylian Mbappé (Real Madrid) - Assist: Vinícius Júnior", team: "home" }
      ] as MatchEvent[]
    },
    {
      id: "sim-match-3",
      competition: "Bundesliga",
      competitionLogo: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/df/Bundesliga_logo_%282017%29.svg/150px-Bundesliga_logo_%282017%29.svg.png",
      homeTeam: "Bayern Munich",
      homeLogo: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/FC_Bayern_M%C3%BCnchen_logo_%282017%29.svg/180px-FC_Bayern_M%C3%BCnchen_logo_%282017%29.svg.png",
      awayTeam: "Borussia Dortmund",
      awayLogo: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/67/Borussia_Dortmund_logo.svg/180px-Borussia_Dortmund_logo.svg.png",
      startTime: new Date(timeM3).toISOString(),
      broadcasterRecommendation: "T Sports",
      seeds: { home: 8, away: 5, pos: 61, shtH: 3, shtA: 1, crnH: 2, crnA: 0, flH: 4, flA: 5 },
      allEvents: [
        { minute: 5, type: "card", detail: "Yellow Card: Emre Can (Dortmund)", team: "away" }
      ] as MatchEvent[]
    },
    {
      id: "sim-match-4",
      competition: "UEFA Champions League",
      competitionLogo: "https://upload.wikimedia.org/wikipedia/en/thumb/b/bf/UEFA_Champions_League_logo_2021.svg/180px-UEFA_Champions_League_logo_2021.svg.png",
      homeTeam: "Manchester City",
      homeLogo: "https://upload.wikimedia.org/wikipedia/en/thumb/e/eb/Manchester_City_FC_badge.svg/180px-Manchester_City_FC_badge.svg.png",
      awayTeam: "Real Madrid",
      awayLogo: "https://upload.wikimedia.org/wikipedia/en/thumb/5/56/Real_Madrid_CF.svg/150px-Real_Madrid_CF.svg.png",
      startTime: new Date(timeM4).toISOString(),
      broadcasterRecommendation: "BTV",
      seeds: { home: 1, away: 3, pos: 67, shtH: 18, shtA: 7, crnH: 11, crnA: 3, flH: 8, flA: 10 },
      allEvents: [
        { minute: 14, type: "goal", detail: "Goal! Kevin De Bruyne (Man City)", team: "home" },
        { minute: 29, type: "goal", detail: "Goal! Rodrygo (Real Madrid)", team: "away" },
        { minute: 76, type: "goal", detail: "Goal! Jude Bellingham (Real Madrid)", team: "away" },
        { minute: 90, type: "card", detail: "Yellow Card: Vinícius Júnior (Real Madrid)", team: "away" }
      ] as MatchEvent[]
    },
    {
      id: "sim-match-5",
      competition: "Serie A",
      competitionLogo: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/Serie_A_logo_2022.svg/100px-Serie_A_logo_2022.svg.png",
      homeTeam: "Juventus",
      homeLogo: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/bc/Juventus_FC_2017_icon_%28black%29.svg/120px-Juventus_FC_2017_icon_%28black%29.svg.png",
      awayTeam: "AC Milan",
      awayLogo: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d0/Logo_of_AC_Milan.svg/130px-Logo_of_AC_Milan.svg.png",
      startTime: new Date(timeM5).toISOString(),
      seeds: { home: 2, away: 9, pos: 50, shtH: 0, shtA: 0, crnH: 0, crnA: 0, flH: 0, flA: 0 },
      allEvents: [] as MatchEvent[]
    },
    {
      id: "sim-match-6",
      competition: "Ligue 1",
      competitionLogo: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Ligue1_logo_2024.svg/150px-Ligue1_logo_2024.svg.png",
      homeTeam: "Paris Saint-Germain",
      homeLogo: "https://upload.wikimedia.org/wikipedia/en/thumb/a/a7/Paris_Saint-Germain_F.C..svg/180px-Paris_Saint-Germain_F.C..svg.png",
      awayTeam: "Marseille",
      awayLogo: "https://upload.wikimedia.org/wikipedia/en/thumb/4/43/Olympique_de_Marseille_logo.svg/150px-Olympique_de_Marseille_logo.svg.png",
      startTime: new Date(timeM6).toISOString(),
      seeds: { home: 6, away: 1, pos: 58, shtH: 14, shtA: 6, crnH: 8, crnA: 2, flH: 10, flA: 15 },
      allEvents: [
        { minute: 22, type: "goal", detail: "Goal! Ousmane Dembélé (PSG)", team: "home" },
        { minute: 41, type: "card", detail: "Yellow Card: Vitinha (PSG)", team: "home" },
        { minute: 58, type: "goal", detail: "Goal! Pierre-Emerick Aubameyang (Marseille)", team: "away" },
        { minute: 73, type: "goal", detail: "Goal! Bradley Barcola (PSG)", team: "home" },
        { minute: 85, type: "goal", detail: "Goal! Kylian Mbappé (PSG)", team: "home" }
      ] as MatchEvent[]
    },
    {
      id: "sim-match-7",
      competition: "FIFA World Cup",
      competitionLogo: "https://upload.wikimedia.org/wikipedia/en/thumb/1/17/2026_FIFA_World_Cup_emblem.svg/150px-2026_FIFA_World_Cup_emblem.svg.png",
      homeTeam: "Argentina",
      homeLogo: "https://upload.wikimedia.org/wikipedia/en/thumb/c/c1/Argentina_national_football_team_crest.svg/150px-Argentina_national_football_team_crest.svg.png",
      awayTeam: "France",
      awayLogo: "https://upload.wikimedia.org/wikipedia/en/thumb/c/c3/Federation_Francaise_de_Football_Logo.svg/140px-Federation_Francaise_de_Football_Logo.svg.png",
      startTime: new Date(timeM7).toISOString(),
      broadcasterRecommendation: "T Sports",
      seeds: { home: 10, away: 10, pos: 49, shtH: 15, shtA: 13, crnH: 8, crnA: 6, flH: 14, flA: 16 },
      allEvents: [
        { minute: 23, type: "goal", detail: "Goal! Lionel Messi (Argentina) - Penalty", team: "home" },
        { minute: 36, type: "goal", detail: "Goal! Ángel Di María (Argentina) - Assist: Alexis Mac Allister", team: "home" },
        { minute: 55, type: "card", detail: "Yellow Card: Adrien Rabiot (France)", team: "away" },
        { minute: 80, type: "goal", detail: "Goal! Kylian Mbappé (France) - Penalty", team: "away" },
        { minute: 81, type: "goal", detail: "Goal! Kylian Mbappé (France) - Volley shot", team: "away" },
        { minute: 98, type: "card", detail: "Yellow Card: Gonzalo Montiel (Argentina)", team: "home" },
        { minute: 102, type: "goal", detail: "Goal! Lionel Messi (Argentina) - Rebound shot", team: "home" }
      ] as MatchEvent[]
    },
    {
      id: "sim-match-8",
      competition: "FIFA World Cup",
      competitionLogo: "https://upload.wikimedia.org/wikipedia/en/thumb/1/17/2026_FIFA_World_Cup_emblem.svg/150px-2026_FIFA_World_Cup_emblem.svg.png",
      homeTeam: "England",
      homeLogo: "https://upload.wikimedia.org/wikipedia/en/thumb/8/8b/The_Three_Lions_badge_of_The_Football_Association.svg/120px-The_Three_Lions_badge_of_The_Football_Association.svg.png",
      awayTeam: "Germany",
      awayLogo: "https://upload.wikimedia.org/wikipedia/en/thumb/e/e3/DFB-Adler_2014.svg/150px-DFB-Adler_2014.svg.png",
      startTime: new Date(timeM8).toISOString(),
      broadcasterRecommendation: "BTV",
      seeds: { home: 1, away: 1, pos: 50, shtH: 0, shtA: 0, crnH: 0, crnA: 0, flH: 0, flA: 0 },
      allEvents: [] as MatchEvent[]
    }
  ];

  return rawMatches.map((m) => {
    const startTimeMs = new Date(m.startTime).getTime();
    const elapsedMinutes = Math.floor((now - startTimeMs) / 60000);
    
    let status: Match["status"] = "SCHEDULED";
    let elapsed = 0;
    let elapsedDisplay = "";
    let homeScore = 0;
    let awayScore = 0;

    if (elapsedMinutes < 0) {
      status = "SCHEDULED";
      elapsed = 0;
      // Format time as hh:mm
      const startDate = new Date(m.startTime);
      elapsedDisplay = startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (elapsedMinutes >= 0 && elapsedMinutes < 45) {
      status = "LIVE";
      elapsed = elapsedMinutes;
      elapsedDisplay = `${elapsed}'`;
    } else if (elapsedMinutes >= 45 && elapsedMinutes < 60) {
      status = "HT";
      elapsed = 45;
      elapsedDisplay = "HT";
    } else if (elapsedMinutes >= 60 && elapsedMinutes < 105) {
      status = "LIVE";
      // 2nd half spans from 60 to 105 server elapsed minutes (corresponds to 45' to 90' match time)
      elapsed = Math.min(90, 45 + (elapsedMinutes - 60));
      elapsedDisplay = `${elapsed}'`;
    } else {
      status = "FT";
      elapsed = 90;
      elapsedDisplay = "FT";
    }

    // Filter events that have happened based on elapsed match time
    let visibleEvents = m.allEvents.filter((ev) => {
      if (status === "FT") return true;
      if (status === "HT") return ev.minute <= 45;
      if (status === "SCHEDULED") return false;
      return ev.minute <= elapsed;
    });

    // Sort events chronologically descending
    visibleEvents = visibleEvents.sort((a, b) => b.minute - a.minute);

    // Calculate goals up to this match minute
    homeScore = visibleEvents.filter((e) => e.type === "goal" && e.team === "home").length;
    awayScore = visibleEvents.filter((e) => e.type === "goal" && e.team === "away").length;

    // Adjust stats dynamically over the match
    const currentStats = { ...m.seeds };
    if (status === "LIVE") {
      const completionRatio = elapsed / 90;
      currentStats.shtH = Math.floor(m.seeds.shtH * completionRatio);
      currentStats.shtA = Math.floor(m.seeds.shtA * completionRatio);
      currentStats.crnH = Math.floor(m.seeds.crnH * completionRatio);
      currentStats.crnA = Math.floor(m.seeds.crnA * completionRatio);
      currentStats.flH = Math.floor(m.seeds.flH * completionRatio);
      currentStats.flA = Math.floor(m.seeds.flA * completionRatio);
    } else if (status === "SCHEDULED") {
      currentStats.shtH = 0;
      currentStats.shtA = 0;
      currentStats.crnH = 0;
      currentStats.crnA = 0;
      currentStats.flH = 0;
      currentStats.flA = 0;
      currentStats.pos = 50;
    }

    return {
      id: m.id,
      competition: m.competition,
      competitionLogo: m.competitionLogo,
      homeTeam: m.homeTeam,
      homeLogo: m.homeLogo,
      awayTeam: m.awayTeam,
      awayLogo: m.awayLogo,
      status,
      elapsed,
      elapsedDisplay,
      homeScore,
      awayScore,
      startTime: m.startTime,
      events: visibleEvents,
      stats: {
        possession: currentStats.pos,
        shotsOnTarget: currentStats.shtH,
        corners: currentStats.crnH,
        fouls: currentStats.flH
      }
    };
  });
}

function getMockStandings(): CompetitionStandings[] {
  return [
    {
      competition: "English Premier League",
      table: [
        { position: 1, name: "Arsenal", logo: "https://upload.wikimedia.org/wikipedia/en/thumb/5/53/Arsenal_FC.svg/180px-Arsenal_FC.svg.png", played: 30, won: 22, drawn: 5, lost: 3, points: 71, goalsFor: 70, goalsAgainst: 24, goalDifference: 46, form: ["W", "W", "D", "W", "W"] },
        { position: 2, name: "Liverpool", logo: "https://upload.wikimedia.org/wikipedia/en/thumb/0/0c/Liverpool_FC.svg/180px-Liverpool_FC.svg.png", played: 30, won: 21, drawn: 7, lost: 2, points: 70, goalsFor: 67, goalsAgainst: 28, goalDifference: 39, form: ["W", "D", "W", "W", "L"] },
        { position: 3, name: "Manchester City", logo: "https://upload.wikimedia.org/wikipedia/en/thumb/e/eb/Manchester_City_FC_badge.svg/180px-Manchester_City_FC_badge.svg.png", played: 30, won: 20, drawn: 7, lost: 3, points: 67, goalsFor: 63, goalsAgainst: 29, goalDifference: 34, form: ["D", "D", "W", "W", "W"] },
        { position: 4, name: "Aston Villa", logo: "https://upload.wikimedia.org/wikipedia/en/thumb/9/9f/Aston_Villa_logo.svg/150px-Aston_Villa_logo.svg.png", played: 31, won: 18, drawn: 5, lost: 8, points: 59, goalsFor: 66, goalsAgainst: 49, goalDifference: 17, form: ["L", "W", "D", "L", "W"] },
        { position: 5, name: "Tottenham", logo: "https://upload.wikimedia.org/wikipedia/en/thumb/b/b4/Tottenham_Hotspur.svg/150px-Tottenham_Hotspur.svg.png", played: 30, won: 17, drawn: 6, lost: 7, points: 57, goalsFor: 62, goalsAgainst: 44, goalDifference: 18, form: ["D", "W", "L", "W", "W"] },
        { position: 6, name: "Chelsea", logo: "https://upload.wikimedia.org/wikipedia/en/thumb/c/cc/Chelsea_FC.svg/180px-Chelsea_FC.svg.png", played: 30, won: 13, drawn: 8, lost: 9, points: 47, goalsFor: 53, goalsAgainst: 50, goalDifference: 3, form: ["W", "D", "W", "D", "W"] }
      ]
    },
    {
      competition: "La Liga",
      table: [
        { position: 1, name: "Real Madrid", logo: "https://upload.wikimedia.org/wikipedia/en/thumb/5/56/Real_Madrid_CF.svg/150px-Real_Madrid_CF.svg.png", played: 30, won: 23, drawn: 6, lost: 1, points: 75, goalsFor: 66, goalsAgainst: 20, goalDifference: 46, form: ["W", "W", "W", "D", "W"] },
        { position: 2, name: "Barcelona", logo: "https://upload.wikimedia.org/wikipedia/en/thumb/4/47/FC_Barcelona.svg/180px-FC_Barcelona.svg.png", played: 30, won: 20, drawn: 7, lost: 3, points: 67, goalsFor: 61, goalsAgainst: 34, goalDifference: 27, form: ["W", "W", "W", "D", "W"] },
        { position: 3, name: "Girona", logo: "https://upload.wikimedia.org/wikipedia/en/thumb/9/90/Girona_FC_logo.svg/150px-Girona_FC_logo.svg.png", played: 30, won: 20, drawn: 5, lost: 5, points: 65, goalsFor: 62, goalsAgainst: 36, goalDifference: 26, form: ["W", "L", "W", "L", "W"] },
        { position: 4, name: "Atletico Madrid", logo: "https://upload.wikimedia.org/wikipedia/en/thumb/f/f4/Atletico_Madrid_2017_logo.svg/180px-Atletico_Madrid_2017_logo.svg.png", played: 30, won: 18, drawn: 4, lost: 8, points: 58, goalsFor: 56, goalsAgainst: 35, goalDifference: 21, form: ["W", "L", "L", "W", "D"] }
      ]
    },
    {
      competition: "FIFA World Cup",
      table: [
        { position: 1, name: "Argentina", logo: "https://upload.wikimedia.org/wikipedia/en/thumb/c/c1/Argentina_national_football_team_crest.svg/150px-Argentina_national_football_team_crest.svg.png", played: 3, won: 3, drawn: 0, lost: 0, points: 9, goalsFor: 8, goalsAgainst: 1, goalDifference: 7, form: ["W", "W", "W"] },
        { position: 2, name: "France", logo: "https://upload.wikimedia.org/wikipedia/en/thumb/c/c3/Federation_Francaise_de_Football_Logo.svg/140px-Federation_Francaise_de_Football_Logo.svg.png", played: 3, won: 2, drawn: 0, lost: 1, points: 6, goalsFor: 6, goalsAgainst: 3, goalDifference: 3, form: ["W", "L", "W"] },
        { position: 3, name: "Poland", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/Logo_Polskiego_Zwi%C4%85zku_Pi%C5%82ki_No%C5%BCnej.svg/120px-Logo_Polskiego_Zwi%C4%85zku_Pi%C5%82ki_No%C5%BCnej.svg.png", played: 3, won: 1, drawn: 0, lost: 2, points: 3, goalsFor: 2, goalsAgainst: 5, goalDifference: -3, form: ["L", "W", "L"] },
        { position: 4, name: "Mexico", logo: "https://upload.wikimedia.org/wikipedia/en/thumb/5/5d/Mexican_Football_Federation_Crest_2021.svg/150px-Mexican_Football_Federation_Crest_2021.svg.png", played: 3, won: 0, drawn: 0, lost: 3, points: 0, goalsFor: 0, goalsAgainst: 7, goalDifference: -7, form: ["L", "L", "L"] }
      ]
    }
  ];
}
