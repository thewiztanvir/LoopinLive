"use client";
/* eslint-disable @next/next/no-img-element */

import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Trophy,
  Clock,
  CheckCircle,
  X,
  Play,
  RefreshCw,
  ChevronRight,
  Users,
  BarChart3,
  MapPin,
  Activity,
  ArrowLeftRight,
  Globe,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Channel {
  id: string;
  name: string;
  logo: string;
  group: string;
  url: string;
  kid?: string;
  key?: string;
}

export interface MatchEvent {
  minute: number;
  type: "goal" | "card" | "sub";
  detail: string;
  team: "home" | "away";
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
  stats: {
    possession: number;
    shotsOnTarget: number;
    corners: number;
    fouls: number;
  };
  broadcasterRecommendation?: string;
  venue?: string;
  leagueSlug: string;
  leagueCategory?: "domestic" | "european" | "international";
  isKnockout?: boolean;
  roundName?: string;
  homePenaltyScore?: number;
  awayPenaltyScore?: number;
  homeWinner?: boolean;
  awayWinner?: boolean;
  homeAdvance?: boolean;
  awayAdvance?: boolean;
  /** 1 = first leg, 2 = second leg, undefined = single-leg tie */
  legNumber?: number;
  /** Shared key linking both legs of the same two-legged tie */
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
  groupName?: string;
  table: StandingTeam[];
}

interface SportsHubProps {
  matches: Match[];
  standings: CompetitionStandings[];
  loading: boolean;
  lastUpdated: Date | null;
  onTuneToChannel?: (channelName: string) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getDhakaDateString(date: Date): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find(p => p.type === "year")?.value;
  const month = parts.find(p => p.type === "month")?.value;
  const day = parts.find(p => p.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Asia/Dhaka",
    hour12: true,
  });
}

function formatStartTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Dhaka",
    hour12: true,
  });
}

function formatMatchDate(iso: string): string {
  if (!iso) return "";
  const matchDate = new Date(iso);
  const now = new Date();
  
  const matchDhakaStr = getDhakaDateString(matchDate);
  const todayDhakaStr = getDhakaDateString(now);
  const tomorrowDhakaStr = getDhakaDateString(new Date(now.getTime() + 86_400_000));
  
  const time = matchDate.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Dhaka",
    hour12: true,
  });

  if (matchDhakaStr === todayDhakaStr) return `Today · ${time}`;
  if (matchDhakaStr === tomorrowDhakaStr) return `Tomorrow · ${time}`;

  const dayName = matchDate.toLocaleDateString("en-US", { weekday: "short", timeZone: "Asia/Dhaka" });
  const day = matchDate.toLocaleDateString("en-US", { day: "numeric", timeZone: "Asia/Dhaka" });
  const month = matchDate.toLocaleDateString("en-US", { month: "short", timeZone: "Asia/Dhaka" });
  return `${dayName} ${day} ${month} · ${time}`;
}

const SoccerBallIcon = ({ className = "w-3.5 h-3.5" }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <circle cx="12" cy="12" r="10" />
    <path d="m12 2-2 3.5 2 2.5 4-1.5z" />
    <path d="M12 22v-4l-3-2.5-3.5 1" />
    <path d="M2.5 10.5 6 12l1 4" />
    <path d="M21.5 10.5 18 12l-1 4" />
    <path d="m16.5 5.5-3.5 1v3.5l3 2" />
    <path d="m7.5 5.5 3.5 1v3.5l-3 2" />
  </svg>
);

const RefCard = ({ color }: { color: "yellow" | "red" }) => (
  <div className={`w-2.5 h-3.5 rounded-[2px] shadow-sm shrink-0 ${color === "yellow" ? "bg-amber-400" : "bg-rose-500"}`} />
);

// ─── Sub-Components ──────────────────────────────────────────────────────────

function TeamLogo({
  src,
  name,
  size = 32,
}: {
  src: string;
  name: string;
  size?: number;
}) {
  const [error, setError] = useState(false);
  return (
    <div
      className="rounded-lg bg-white/10 p-0.5 flex items-center justify-center shrink-0"
      style={{ width: size + 4, height: size + 4 }}
    >
      {!error && src ? (
        <img
          src={src}
          alt={name}
          width={size}
          height={size}
          className="rounded-md object-contain"
          onError={() => setError(true)}
        />
      ) : (
        <span
          className="font-bold text-white/60 select-none"
          style={{ fontSize: size * 0.45 }}
        >
          {name.charAt(0)}
        </span>
      )}
    </div>
  );
}

function StatusBadge({ status, elapsed }: { status: Match["status"]; elapsed: string }) {
  if (status === "LIVE") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-400 text-[11px] font-bold uppercase tracking-wider">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
        </span>
        {elapsed}
      </span>
    );
  }
  if (status === "HT") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-400 text-[11px] font-bold uppercase tracking-wider">
        HT
      </span>
    );
  }
  if (status === "FT") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 text-gray-400 text-[11px] font-bold uppercase tracking-wider">
        FT
      </span>
    );
  }
  return null;
}

function SkeletonCard() {
  return (
    <div className="bg-white/[0.02] border border-white/5 rounded-2xl animate-pulse overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.04] bg-white/[0.01]">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-sm bg-white/10" />
          <div className="h-3 w-24 rounded bg-white/10" />
        </div>
        <div className="h-5 w-14 rounded-full bg-white/10" />
      </div>
      {/* Body */}
      <div className="px-5 py-6 flex items-center justify-between gap-4">
        <div className="flex-1 flex items-center justify-end gap-3">
          <div className="h-4 w-24 rounded bg-white/10" />
          <div className="w-9 h-9 rounded-lg bg-white/10" />
        </div>
        <div className="w-20 h-10 rounded-xl bg-white/10 shrink-0" />
        <div className="flex-1 flex items-center justify-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-white/10" />
          <div className="h-4 w-24 rounded bg-white/10" />
        </div>
      </div>
      {/* Footer */}
      <div className="flex items-center justify-between px-5 py-3 border-t border-white/[0.04] bg-white/[0.01]">
        <div className="h-3 w-28 rounded bg-white/10" />
        <div className="h-6 w-20 rounded-lg bg-white/10" />
      </div>
    </div>
  );
}

// ─── ScoreDisplay ────────────────────────────────────────────────────────────
// Detects score changes and fires a CSS flash animation without re-mounting.
function ScoreDisplay({
  value,
  winning,
  className = "text-2xl font-black",
}: {
  value: number;
  winning: boolean;
  className?: string;
}) {
  const prevRef = useRef(value);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (prevRef.current !== value) {
      prevRef.current = value;
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 900);
      return () => clearTimeout(t);
    }
  }, [value]);

  return (
    <span
      className={`${className} tabular-nums leading-none ${
        flash
          ? "score-flash"
          : winning
          ? "text-white"
          : "text-white/50"
      }`}
    >
      {value}
    </span>
  );
}

// ─── StatBar ─────────────────────────────────────────────────────────────────
function StatBar({
  label,
  homeVal,
  awayVal,
  isPercentage = false,
}: {
  label: string;
  homeVal: number;
  awayVal: number;
  isPercentage?: boolean;
}) {
  const total = homeVal + awayVal || 1;
  const homePct = (homeVal / total) * 100;
  const awayPct = (awayVal / total) * 100;

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-gray-400">
        <span className="font-semibold text-white/80">
          {isPercentage ? `${homeVal}%` : homeVal}
        </span>
        <span className="text-[10px] uppercase tracking-wider font-bold text-gray-500">
          {label}
        </span>
        <span className="font-semibold text-white/80">
          {isPercentage ? `${awayVal}%` : awayVal}
        </span>
      </div>
      <div className="flex h-1.5 rounded-full overflow-hidden bg-white/5 gap-0.5">
        <motion.div
          className="bg-primary rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${homePct}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
        <motion.div
          className="bg-rose-500 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${awayPct}%` }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
        />
      </div>
    </div>
  );
}

// ─── Helper — picks first match per unique competition (preserves priority order) ─
function onePerCompetition(list: Match[]): Match[] {
  const seen = new Set<string>();
  return list.filter((m) => {
    if (seen.has(m.competition)) return false;
    seen.add(m.competition);
    return true;
  });
}

const PRIORITY_ORDER = [
  // European cups first
  "Champions League",
  "Europa League",
  "Conference League",
  // Top 5 domestic leagues
  "Premier League",
  "La Liga",
  "Serie A",
  "Bundesliga",
  "Ligue 1",
  // Other domestic
  "Primeira Liga",
  "Eredivisie",
  "Championship",
  "MLS",
  // International
  "UEFA Nations League",
  "UEFA European Championship",
  "Copa América",
  "AFCON",
  "AFC Asian Cup",
  "UEFA WC Qualifiers",
  "CONCACAF WC Qualifiers",
  "CONMEBOL WC Qualifiers",
  "AFC WC Qualifiers",
  "CAF WC Qualifiers",
  "OFC WC Qualifiers",
  "CONCACAF Nations League",
  "International Friendlies",
  "FIFA World Cup",
];

const getPriorityScore = (name: string): number => {
  const lowerName = name.toLowerCase();
  for (let i = 0; i < PRIORITY_ORDER.length; i++) {
    if (lowerName.includes(PRIORITY_ORDER[i].toLowerCase())) {
      return i;
    }
  }
  return 999;
};

// ─── Competition format classification ───────────────────────────────────────
// Returns whether a competition is domestic (table-only), a european cup
// (league phase + knockout), or an international cup (groups + knockout).
type CompetitionFormat = "domestic" | "european_cup" | "international_cup";

const DOMESTIC_COMP_NAMES = [
  "premier league", "la liga", "serie a", "bundesliga", "ligue 1",
  "primeira liga", "eredivisie", "championship", "mls", "liga", "süper lig",
  "scottish premiership", "jupiler", "primeira", "allsvenskan",
];

const EUROPEAN_CUP_NAMES = [
  "champions league", "europa league", "conference league",
];

function getCompetitionFormat(compName: string): CompetitionFormat {
  const l = compName.toLowerCase();
  if (EUROPEAN_CUP_NAMES.some(n => l.includes(n))) return "european_cup";
  if (DOMESTIC_COMP_NAMES.some(n => l.includes(n))) return "domestic";
  // International cups: World Cup, Nations League, Copa, AFCON, etc.
  return "international_cup";
}

// ─── Competition phase detection ─────────────────────────────────────────────
// Determines what phase a competition is currently in given available data.
type CompetitionPhase =
  | "league_only"     // domestic league: table only, never a bracket
  | "league_phase"    // european/international cup in group/league stage
  | "knockout_only"   // only knockout matches, no standings
  | "both";           // standings AND knockout matches (UCL after R16 draw)

function getCompetitionPhase(
  format: CompetitionFormat,
  hasStandings: boolean,
  hasKnockoutMatches: boolean
): CompetitionPhase {
  if (format === "domestic") return "league_only";
  if (hasStandings && hasKnockoutMatches) return "both";
  if (hasStandings) return "league_phase";
  if (hasKnockoutMatches) return "knockout_only";
  return "league_phase"; // default fallback — show standings section even if empty
}

// ─── Two-legged tie grouping ──────────────────────────────────────────────────
// Groups knockout matches into ties (1 or 2 legs) keyed by tieId.
// Single-leg matches (no tieId) are each their own group.
interface KnockoutTie {
  tieId: string;
  leg1: Match | null;
  leg2: Match | null;
  isTwoLegged: boolean;
  roundName: string;
}

function groupKnockoutByTie(matches: Match[]): KnockoutTie[] {
  const tieMap = new Map<string, KnockoutTie>();
  let singleLegIdx = 0;

  for (const m of matches) {
    if (m.tieId && m.legNumber) {
      // Two-legged tie
      if (!tieMap.has(m.tieId)) {
        tieMap.set(m.tieId, {
          tieId: m.tieId,
          leg1: null,
          leg2: null,
          isTwoLegged: true,
          roundName: m.roundName || "Knockout",
        });
      }
      const tie = tieMap.get(m.tieId)!;
      if (m.legNumber === 1) tie.leg1 = m;
      else if (m.legNumber === 2) tie.leg2 = m;
    } else {
      // Single-leg: each match is its own group
      const key = `single-${singleLegIdx++}`;
      tieMap.set(key, {
        tieId: key,
        leg1: m,
        leg2: null,
        isTwoLegged: false,
        roundName: m.roundName || "Knockout",
      });
    }
  }

  return Array.from(tieMap.values()).sort((a, b) => {
    const dateA = new Date(a.leg1?.startTime || a.leg2?.startTime || 0).getTime();
    const dateB = new Date(b.leg1?.startTime || b.leg2?.startTime || 0).getTime();
    return dateA - dateB;
  });
}


// ─── Helper — groups matches by competition and sorts by priority ─────────────────
function groupMatchesByCompetition(matchList: Match[]): { competition: string; competitionLogo: string; matches: Match[] }[] {
  const groupedMap: Record<string, Match[]> = {};
  matchList.forEach((m) => {
    const comp = m.competition;
    if (!groupedMap[comp]) {
      groupedMap[comp] = [];
    }
    groupedMap[comp].push(m);
  });

  const groupedList = Object.entries(groupedMap).map(([competition, matches]) => ({
    competition,
    competitionLogo: matches[0]?.competitionLogo || "",
    matches,
  }));

  groupedList.sort((a, b) => {
    const scoreA = getPriorityScore(a.competition);
    const scoreB = getPriorityScore(b.competition);
    if (scoreA !== scoreB) {
      return scoreA - scoreB;
    }
    return a.competition.localeCompare(b.competition);
  });

  return groupedList;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function SportsHub({
  matches,
  standings,
  loading,
  lastUpdated,
  onTuneToChannel,
}: SportsHubProps) {
  const [activeTab, setActiveTab] = useState<
    "overview" | "live" | "upcoming" | "results" | "standings" | "international"
  >("overview");
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [selectedCompetition, setSelectedCompetition] = useState("");
  const [selectedUpcomingFilter, setSelectedUpcomingFilter] = useState("All");
  const [selectedResultsFilter, setSelectedResultsFilter] = useState("All");

  // Group standings by competition name
  const standingsByCompetition = useMemo(() => {
    const grouped: Record<string, CompetitionStandings[]> = {};
    standings.forEach((s) => {
      if (!grouped[s.competition]) {
        grouped[s.competition] = [];
      }
      grouped[s.competition].push(s);
    });
    return grouped;
  }, [standings]);

  // Combine competitions from standings and knockout matches
  const competitionsList = useMemo(() => {
    const compSet = new Set<string>();
    Object.keys(standingsByCompetition).forEach((c) => compSet.add(c));
    matches.forEach((m) => {
      if (m.isKnockout) compSet.add(m.competition);
    });
    return Array.from(compSet).sort((a, b) => getPriorityScore(a) - getPriorityScore(b));
  }, [standingsByCompetition, matches]);

  // Set default standings competition when data arrives
  // Prefer Champions League, then top domestic leagues, then anything else
  useEffect(() => {
    if (competitionsList.length > 0 && !selectedCompetition) {
      const preferred = [
        "Champions League",
        "Premier League",
        "La Liga",
        "Serie A",
        "Bundesliga",
        "Ligue 1",
      ];
      const defaultComp =
        preferred
          .map((p) => competitionsList.find((c) => c.toLowerCase().includes(p.toLowerCase())))
          .find(Boolean) ?? competitionsList[0];
      setSelectedCompetition(defaultComp);
    }
  }, [competitionsList, selectedCompetition]);

  // Keep selected match details synced with parent polling updates
  useEffect(() => {
    if (selectedMatch) {
      const updated = matches.find((m) => m.id === selectedMatch.id);
      if (updated) setSelectedMatch(updated);
    }
  }, [matches, selectedMatch]);

  // Close detail panel on Escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedMatch) setSelectedMatch(null);
    },
    [selectedMatch]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // ── Derived match lists ────────────────────────────────────────────────────

  // All LIVE + HT — unfiltered
  const liveMatches = useMemo(
    () => matches.filter((m) => m.status === "LIVE" || m.status === "HT"),
    [matches]
  );

  // All SCHEDULED — sorted soonest first
  const upcomingMatches = useMemo(
    () =>
      [...matches.filter((m) => m.status === "SCHEDULED")].sort(
        (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      ),
    [matches]
  );

  // All FT — sorted most recent first
  const completedMatches = useMemo(
    () =>
      [...matches.filter((m) => m.status === "FT")].sort(
        (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
      ),
    [matches]
  );

  // International matches only (all statuses)
  const internationalMatches = useMemo(
    () => matches.filter((m) => m.leagueCategory === "international"),
    [matches]
  );
  const internationalLive = useMemo(
    () => internationalMatches.filter((m) => m.status === "LIVE" || m.status === "HT"),
    [internationalMatches]
  );
  const internationalUpcoming = useMemo(
    () =>
      [...internationalMatches.filter((m) => m.status === "SCHEDULED")].sort(
        (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      ),
    [internationalMatches]
  );
  const internationalResults = useMemo(
    () =>
      [...internationalMatches.filter((m) => m.status === "FT")].sort(
        (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
      ),
    [internationalMatches]
  );
  const groupedInternationalMatches = useMemo(
    () => groupMatchesByCompetition(internationalMatches),
    [internationalMatches]
  );

  // Grouped Live Matches
  const groupedLiveMatches = useMemo(() => {
    const groups = groupMatchesByCompetition(liveMatches);
    return groups;
  }, [liveMatches]);

  // Grouped Upcoming Matches: sorted ascending by kickoff time
  const groupedUpcomingMatches = useMemo(() => {
    const groups = groupMatchesByCompetition(upcomingMatches);
    groups.forEach((g) => {
      g.matches.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    });
    return groups;
  }, [upcomingMatches]);

  // Grouped Completed Matches: sorted descending by kickoff time
  const groupedCompletedMatches = useMemo(() => {
    const groups = groupMatchesByCompetition(completedMatches);
    groups.forEach((g) => {
      g.matches.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
    });
    return groups;
  }, [completedMatches]);

  // Overview: Show all relevant matches, paginated by MatchSection
  const overviewLive = useMemo(() => liveMatches, [liveMatches]);
  const overviewUpcoming = useMemo(() => upcomingMatches, [upcomingMatches]);
  const overviewResults = useMemo(() => completedMatches, [completedMatches]);

  // Selected standings list is computed dynamically in render block

  // ─── Render ────────────────────────────────────────────────────────────────

  const tabs = [
    { id: "overview" as const, label: "Overview" },
    { id: "live" as const, label: liveMatches.length > 0 ? `Live · ${liveMatches.length}` : "Live" },
    { id: "upcoming" as const, label: "Upcoming" },
    { id: "results" as const, label: "Results" },
    { id: "standings" as const, label: "Standings" },
    { id: "international" as const, label: internationalMatches.length > 0 ? `International · ${internationalMatches.length}` : "International" },
  ];

  return (
    <div className="w-full flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <Trophy className="w-5 h-5 text-primary shrink-0" />
          <h2 className="text-xl font-bold text-white tracking-tight">
            Sports Hub
          </h2>
        </div>

        <div className="flex items-center gap-3 text-xs text-gray-400">
          {lastUpdated && (
            <>
              <span className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                </span>
                <span className="text-primary font-medium">Auto-updating</span>
              </span>
              <span className="flex items-center gap-1 text-gray-500">
                <RefreshCw className="w-3 h-3" />
                {formatTime(lastUpdated)}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Tab Pills — 5 tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-white/5 overflow-x-auto no-scrollbar">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`relative px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-200 ${
              activeTab === tab.id
                ? "bg-primary text-white shadow-lg shadow-primary/20"
                : "text-gray-400 hover:text-white hover:bg-white/5"
            }`}
          >
            {/* Pulsing dot on Live pill when there are live matches */}
            {tab.id === "live" && liveMatches.length > 0 && activeTab !== "live" && (
              <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
              </span>
            )}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="flex flex-col gap-5"
        >

          {/* ── OVERVIEW ─────────────────────────────────────────────────────── */}
          {/* OVERVIEW */}
          {activeTab === "overview" && (
            <>
              {/* Skeleton */}
              {loading && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <SkeletonCard key={i} />
                  ))}
                </div>
              )}
              {!loading && overviewLive.length === 0 && overviewUpcoming.length === 0 && overviewResults.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-gray-500 gap-3">
                  <SoccerBallIcon className="w-10 h-10 text-gray-600 shrink-0" />
                  <p className="text-sm font-medium">No matches available right now</p>
                </div>
              )}
              {!loading && (overviewLive.length > 0 || overviewUpcoming.length > 0 || overviewResults.length > 0) && (
                <div className="flex flex-col gap-6 animate-fadeIn">

                  {/* ── STAT PILLS ── */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <button onClick={() => setActiveTab("live")} className={`flex flex-col items-center justify-center gap-1 p-4 rounded-2xl border transition-all duration-200 hover:scale-[1.03] active:scale-[0.97] ${liveMatches.length > 0 ? "bg-rose-500/10 border-rose-500/30 hover:bg-rose-500/15 hover:border-rose-500/50" : "bg-white/5 border-white/5 hover:bg-white/8"}`}>
                      {liveMatches.length > 0 && <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse mb-0.5" />}
                      <span className={`text-2xl font-black tabular-nums ${liveMatches.length > 0 ? "text-rose-400" : "text-white"}`}>{liveMatches.length}</span>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Live Now</span>
                    </button>
                    <button onClick={() => setActiveTab("upcoming")} className="flex flex-col items-center justify-center gap-1 p-4 rounded-2xl border bg-blue-500/10 border-blue-500/20 hover:bg-blue-500/15 hover:border-blue-500/35 transition-all duration-200 hover:scale-[1.03] active:scale-[0.97]">
                      <span className="text-2xl font-black text-blue-300 tabular-nums">{upcomingMatches.length}</span>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Upcoming</span>
                    </button>
                    <button onClick={() => setActiveTab("results")} className="flex flex-col items-center justify-center gap-1 p-4 rounded-2xl border bg-white/5 border-white/5 hover:bg-white/8 hover:border-white/10 transition-all duration-200 hover:scale-[1.03] active:scale-[0.97]">
                      <span className="text-2xl font-black text-white tabular-nums">{completedMatches.length}</span>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Results</span>
                    </button>
                    <button onClick={() => setActiveTab("standings")} className="flex flex-col items-center justify-center gap-1 p-4 rounded-2xl border bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/15 hover:border-emerald-500/35 transition-all duration-200 hover:scale-[1.03] active:scale-[0.97]">
                      <span className="text-2xl font-black text-emerald-400 tabular-nums">{competitionsList.length}</span>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Standings</span>
                    </button>
                  </div>

                  {/* ── LIVE NOW ── */}
                  {overviewLive.length > 0 && (
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="relative flex h-2.5 w-2.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" /><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500" /></span>
                          <span className="text-sm font-bold text-white">Live Now</span>
                          <span className="text-xs text-rose-400 font-semibold bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">{overviewLive.length} matches</span>
                        </div>
                        <button onClick={() => setActiveTab("live")} className="text-[10px] font-bold uppercase tracking-wider text-rose-400 hover:text-white transition-colors flex items-center gap-1">See all <ChevronRight className="w-3 h-3" /></button>
                      </div>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                        {overviewLive.slice(0, 4).map((match, i) => (
                          <motion.div key={match.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: i * 0.05 }}>
                            <MatchCard match={match} isSelected={selectedMatch?.id === match.id} onSelect={() => setSelectedMatch(match)} onTuneToChannel={onTuneToChannel} />
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── MAIN GRID: Left content + Right sidebar ── */}
                  <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-6">

                    {/* LEFT */}
                    <div className="flex flex-col gap-5">

                      {/* UCL Spotlight */}
                      <button onClick={() => setActiveTab("standings")} className="relative rounded-2xl overflow-hidden border border-blue-800/40 bg-gradient-to-br from-[#071428] via-[#0a1e3a] to-[#040c18] p-5 shadow-[0_0_40px_rgba(30,70,160,0.12)] group text-left w-full transition-all hover:border-blue-600/50 hover:shadow-[0_0_50px_rgba(30,70,160,0.2)]">
                        <div className="absolute top-0 right-0 w-56 h-56 bg-blue-700/8 rounded-full -translate-y-1/3 translate-x-1/3 blur-3xl pointer-events-none" />
                        <div className="relative flex items-center justify-between gap-4">
                          <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-[#0d2347] border border-blue-700/30 flex items-center justify-center shadow-xl shrink-0">
                              <img src="https://a.espncdn.com/i/leaguelogos/soccer/500/2.png" alt="UCL" className="w-9 h-9 object-contain" onError={e => { (e.target as HTMLImageElement).style.display="none"; }} />
                            </div>
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400/60 mb-0.5">UEFA European Cup</p>
                              <h3 className="text-white font-bold text-base leading-tight">Champions League</h3>
                              <p className="text-blue-300/50 text-xs mt-0.5">2026/27 · Group stage fixtures coming soon</p>
                            </div>
                          </div>
                          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-blue-400 bg-blue-500/10 px-3 py-2 rounded-xl border border-blue-500/20 group-hover:bg-blue-500/20 transition-colors">View table</span>
                        </div>
                      </button>

                      {/* Europa League Spotlight */}
                      <button onClick={() => setActiveTab("standings")} className="relative rounded-2xl overflow-hidden border border-orange-900/30 bg-gradient-to-br from-[#140800] via-[#1e1000] to-[#0a0500] p-5 shadow-[0_0_30px_rgba(200,80,0,0.06)] group text-left w-full transition-all hover:border-orange-700/40 hover:shadow-[0_0_40px_rgba(200,80,0,0.12)]">
                        <div className="relative flex items-center justify-between gap-4">
                          <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-orange-950/60 border border-orange-800/25 flex items-center justify-center shadow-xl shrink-0">
                              <img src="https://a.espncdn.com/i/leaguelogos/soccer/500/2572.png" alt="UEL" className="w-9 h-9 object-contain" onError={e => { (e.target as HTMLImageElement).style.display="none"; }} />
                            </div>
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-widest text-orange-400/60 mb-0.5">UEFA European Cup</p>
                              <h3 className="text-white font-bold text-base leading-tight">Europa League</h3>
                              <p className="text-orange-300/40 text-xs mt-0.5">2026/27 · Fixtures announced soon</p>
                            </div>
                          </div>
                          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-orange-400 bg-orange-500/10 px-3 py-2 rounded-xl border border-orange-500/15 group-hover:bg-orange-500/20 transition-colors">View table</span>
                        </div>
                      </button>

                      {/* Upcoming Fixtures grouped by league */}
                      {groupedUpcomingMatches.length > 0 && (
                        <div className="flex flex-col gap-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4 text-blue-400" />
                              <span className="text-sm font-bold text-white">Upcoming Fixtures</span>
                            </div>
                            <button onClick={() => { setActiveTab("upcoming"); setSelectedUpcomingFilter("All"); }} className="text-[10px] font-bold uppercase tracking-wider text-blue-400 hover:text-white transition-colors flex items-center gap-1">All <ChevronRight className="w-3 h-3" /></button>
                          </div>
                          {groupedUpcomingMatches.slice(0, 3).map((group, gi) => (
                            <motion.div key={group.competition} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, delay: gi * 0.06 }} className="rounded-2xl border border-white/5 overflow-hidden">
                              <div className="flex items-center justify-between px-4 py-2.5 bg-white/[0.025] border-b border-white/5">
                                <div className="flex items-center gap-2">
                                  {group.competitionLogo
                                    ? <img src={group.competitionLogo} alt="" className="w-4 h-4 object-contain" onError={e => { (e.target as HTMLImageElement).style.display="none"; }} />
                                    : <SoccerBallIcon className="w-3.5 h-3.5 text-gray-600" />}
                                  <span className="text-xs font-bold uppercase tracking-wider text-white">{group.competition}</span>
                                  <span className="text-[10px] text-gray-600">· {group.matches.length}</span>
                                </div>
                                <button onClick={() => { setActiveTab("upcoming"); setSelectedUpcomingFilter(group.competition); }} className="text-[9px] font-bold text-primary hover:text-white transition-colors flex items-center gap-0.5">Full schedule <ChevronRight className="w-2.5 h-2.5" /></button>
                              </div>
                              <div className="bg-black/20 divide-y divide-white/[0.03]">
                                {group.matches.slice(0, 3).map((match) => (
                                  <button key={match.id} onClick={() => setSelectedMatch(match)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.04] transition-colors group/row text-left">
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                      {match.homeLogo && <img src={match.homeLogo} alt="" className="w-5 h-5 object-contain shrink-0" onError={e => { (e.target as HTMLImageElement).style.display="none"; }} />}
                                      <span className="text-xs font-semibold text-white truncate">{match.homeTeam}</span>
                                    </div>
                                    <div className="flex flex-col items-center shrink-0 min-w-[52px]">
                                      <span className="text-[9px] font-bold text-gray-500 uppercase">vs</span>
                                      <span className="text-[9px] text-gray-600">{new Date(match.startTime).toLocaleDateString("en-GB",{month:"short",day:"numeric"})}</span>
                                    </div>
                                    <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
                                      <span className="text-xs font-semibold text-white truncate text-right">{match.awayTeam}</span>
                                      {match.awayLogo && <img src={match.awayLogo} alt="" className="w-5 h-5 object-contain shrink-0" onError={e => { (e.target as HTMLImageElement).style.display="none"; }} />}
                                    </div>
                                    <ChevronRight className="w-3 h-3 text-gray-700 group-hover/row:text-gray-400 transition-colors shrink-0" />
                                  </button>
                                ))}
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      )}

                      {/* Recent Results grouped by league */}
                      {groupedCompletedMatches.length > 0 && (
                        <div className="flex flex-col gap-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <CheckCircle className="w-4 h-4 text-gray-400" />
                              <span className="text-sm font-bold text-white">Recent Results</span>
                            </div>
                            <button onClick={() => { setActiveTab("results"); setSelectedResultsFilter("All"); }} className="text-[10px] font-bold uppercase tracking-wider text-gray-400 hover:text-white transition-colors flex items-center gap-1">All <ChevronRight className="w-3 h-3" /></button>
                          </div>
                          {groupedCompletedMatches.slice(0, 2).map((group, gi) => (
                            <motion.div key={group.competition} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, delay: gi * 0.06 }} className="rounded-2xl border border-white/5 overflow-hidden">
                              <div className="flex items-center justify-between px-4 py-2.5 bg-white/[0.02] border-b border-white/5">
                                <div className="flex items-center gap-2">
                                  {group.competitionLogo
                                    ? <img src={group.competitionLogo} alt="" className="w-4 h-4 object-contain grayscale opacity-50" onError={e => { (e.target as HTMLImageElement).style.display="none"; }} />
                                    : <CheckCircle className="w-3.5 h-3.5 text-gray-600" />}
                                  <span className="text-xs font-bold uppercase tracking-wider text-gray-300">{group.competition}</span>
                                  <span className="text-[10px] text-gray-600">· {group.matches.length}</span>
                                </div>
                                <button onClick={() => { setActiveTab("results"); setSelectedResultsFilter(group.competition); }} className="text-[9px] font-bold text-gray-500 hover:text-white transition-colors flex items-center gap-0.5">Full results <ChevronRight className="w-2.5 h-2.5" /></button>
                              </div>
                              <div className="bg-black/20 divide-y divide-white/[0.03]">
                                {group.matches.slice(0, 3).map((match) => (
                                  <button key={match.id} onClick={() => setSelectedMatch(match)} className="w-full flex items-center gap-2 px-4 py-3 hover:bg-white/[0.04] transition-colors text-left">
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                      {match.homeLogo && <img src={match.homeLogo} alt="" className="w-5 h-5 object-contain shrink-0" onError={e => { (e.target as HTMLImageElement).style.display="none"; }} />}
                                      <span className={`text-xs font-semibold truncate ${match.homeScore > match.awayScore ? "text-white" : "text-gray-500"}`}>{match.homeTeam}</span>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0 px-2">
                                      <span className={`text-sm font-black tabular-nums ${match.homeScore > match.awayScore ? "text-white" : "text-gray-500"}`}>{match.homeScore}</span>
                                      <span className="text-gray-600 text-xs font-bold">–</span>
                                      <span className={`text-sm font-black tabular-nums ${match.awayScore > match.homeScore ? "text-white" : "text-gray-500"}`}>{match.awayScore}</span>
                                    </div>
                                    <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
                                      <span className={`text-xs font-semibold truncate text-right ${match.awayScore > match.homeScore ? "text-white" : "text-gray-500"}`}>{match.awayTeam}</span>
                                      {match.awayLogo && <img src={match.awayLogo} alt="" className="w-5 h-5 object-contain shrink-0" onError={e => { (e.target as HTMLImageElement).style.display="none"; }} />}
                                    </div>
                                  </button>
                                ))}
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* RIGHT: Standings sidebar */}
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Trophy className="w-4 h-4 text-emerald-400" />
                          <span className="text-sm font-bold text-white">Standings</span>
                        </div>
                        <button onClick={() => setActiveTab("standings")} className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 hover:text-white transition-colors flex items-center gap-1">Full tables <ChevronRight className="w-3 h-3" /></button>
                      </div>

                      {competitionsList.slice(0, 5).map((compName) => {
                        const compStandings = standingsByCompetition[compName];
                        if (!compStandings || compStandings.length === 0) return null;
                        const top5 = compStandings[0].table.slice(0, 5);
                        return (
                          <div key={compName} className="rounded-2xl border border-white/5 overflow-hidden bg-black/20">
                            <div className="flex items-center justify-between px-3 py-2 bg-white/[0.03] border-b border-white/5">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-300">{compName}</span>
                              <button onClick={() => { setActiveTab("standings"); setSelectedCompetition(compName); }} className="text-[9px] font-bold text-primary hover:text-white transition-colors">Full ›</button>
                            </div>
                            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-2 px-3 py-1 border-b border-white/[0.04]">
                              <span className="text-[8px] font-bold text-gray-700 uppercase tracking-wider">Club</span>
                              <span className="text-[8px] font-bold text-gray-700 uppercase tracking-wider text-center w-5">P</span>
                              <span className="text-[8px] font-bold text-gray-700 uppercase tracking-wider text-center w-5">GD</span>
                              <span className="text-[8px] font-bold text-gray-700 uppercase tracking-wider text-center w-6">Pts</span>
                            </div>
                            {top5.map((entry, idx) => (
                              <div key={entry.name} className="grid grid-cols-[1fr_auto_auto_auto] gap-x-2 px-3 py-1.5 items-center border-b border-white/[0.02] last:border-0 hover:bg-white/[0.02] transition-colors">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className={`text-[9px] font-bold w-3.5 shrink-0 ${idx === 0 ? "text-emerald-400" : idx <= 3 ? "text-blue-400" : "text-gray-600"}`}>{idx + 1}</span>
                                  {entry.logo && <img src={entry.logo} alt="" className="w-3.5 h-3.5 object-contain shrink-0" onError={e => { (e.target as HTMLImageElement).style.display="none"; }} />}
                                  <span className="text-[11px] font-semibold text-white truncate">{entry.name}</span>
                                </div>
                                <span className="text-[10px] text-gray-500 text-center w-5 tabular-nums">{entry.played}</span>
                                <span className={`text-[10px] text-center w-5 tabular-nums ${entry.goalDifference > 0 ? "text-emerald-400" : entry.goalDifference < 0 ? "text-rose-400" : "text-gray-500"}`}>{entry.goalDifference > 0 ? `+${entry.goalDifference}` : entry.goalDifference}</span>
                                <span className="text-[12px] font-black text-white text-center w-6 tabular-nums">{entry.points}</span>
                              </div>
                            ))}
                          </div>
                        );
                      })}

                      {competitionsList.length === 0 && (
                        <div className="rounded-2xl border border-white/5 bg-black/20 p-6 flex flex-col items-center gap-2 text-center">
                          <Trophy className="w-7 h-7 text-gray-700" />
                          <p className="text-xs text-gray-500 font-medium">Standings appear once the season begins</p>
                        </div>
                      )}

                      {internationalMatches.length > 0 && (
                        <div className="rounded-2xl border border-amber-500/15 overflow-hidden">
                          <div className="flex items-center justify-between px-3 py-2.5 bg-amber-500/5 border-b border-amber-500/10">
                            <div className="flex items-center gap-2">
                              <Globe className="w-3.5 h-3.5 text-amber-400" />
                              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">International</span>
                            </div>
                            <button onClick={() => setActiveTab("international")} className="text-[9px] font-bold text-amber-400 hover:text-white transition-colors">See all ›</button>
                          </div>
                          {[...internationalLive, ...internationalUpcoming, ...internationalResults].slice(0, 4).map((match) => (
                            <button key={match.id} onClick={() => setSelectedMatch(match)} className="w-full flex items-center justify-between px-3 py-2.5 border-b border-white/[0.03] last:border-0 hover:bg-white/[0.03] transition-colors text-left">
                              <span className="text-xs text-white font-medium truncate flex-1">{match.homeTeam}</span>
                              {match.status === "SCHEDULED"
                                ? <span className="text-[9px] text-gray-500 shrink-0 px-2">{new Date(match.startTime).toLocaleDateString("en-GB",{month:"short",day:"numeric"})}</span>
                                : <span className="text-xs font-bold text-white shrink-0 px-2 tabular-nums">{match.homeScore}–{match.awayScore}</span>}
                              <span className="text-xs text-white font-medium truncate flex-1 text-right">{match.awayTeam}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── LIVE ────────────────────────────────────────────────────────── */}
          {activeTab === "live" && (
            groupedLiveMatches.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-500 gap-3">
                <SoccerBallIcon className="w-10 h-10 text-gray-600 shrink-0" />
                <p className="text-sm font-medium">No live matches right now</p>
                <p className="text-xs text-gray-600">Check Upcoming for what&apos;s on next</p>
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                {groupedLiveMatches.map((group) => (
                  <MatchSection
                    key={group.competition}
                    title={group.competition}
                    icon={
                      <span className="relative flex h-2.5 w-2.5 mr-1">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500" />
                      </span>
                    }
                    titleClass="text-rose-400"
                    matches={group.matches}
                    selectedMatch={selectedMatch}
                    onSelect={setSelectedMatch}
                    onTuneToChannel={onTuneToChannel}
                  />
                ))}
              </div>
            )
          )}

          {/* ── UPCOMING ─────────────────────────────────────────────────────── */}
          {activeTab === "upcoming" && (
            groupedUpcomingMatches.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-500 gap-3">
                <Clock className="w-10 h-10 text-gray-600 shrink-0" />
                <p className="text-sm font-medium">No upcoming matches scheduled</p>
              </div>
            ) : (
              <div className="flex flex-col gap-6 animate-fadeIn">
                {/* Competition Chips */}
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 mb-2">
                  <button
                    onClick={() => setSelectedUpcomingFilter("All")}
                    className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-all duration-200 shrink-0 ${
                      selectedUpcomingFilter === "All"
                        ? "bg-primary text-white shadow-lg shadow-primary/20 border-primary"
                        : "bg-white/5 border-white/5 text-gray-400 hover:text-white hover:bg-white/10"
                    }`}
                  >
                    All Matches
                  </button>
                  {groupedUpcomingMatches.map((group) => (
                    <button
                      key={group.competition}
                      onClick={() => setSelectedUpcomingFilter(group.competition)}
                      className={`px-4 py-1.5 flex items-center gap-2 rounded-full text-xs font-semibold whitespace-nowrap border transition-all duration-200 shrink-0 ${
                        selectedUpcomingFilter === group.competition
                          ? "bg-primary text-white shadow-lg shadow-primary/20 border-primary"
                          : "bg-white/5 border-white/5 text-gray-400 hover:text-white hover:bg-white/10"
                      }`}
                    >
                      {group.competitionLogo && (
                        <img src={group.competitionLogo} alt={group.competition} className="w-3.5 h-3.5 object-contain opacity-80" />
                      )}
                      {group.competition}
                    </button>
                  ))}
                </div>

                {/* Match Lists */}
                {groupedUpcomingMatches
                  .filter((group) => selectedUpcomingFilter === "All" || group.competition === selectedUpcomingFilter)
                  .map((group) => {
                    const isPreview = selectedUpcomingFilter === "All";
                    return (
                      <MatchSection
                        key={group.competition}
                        title={group.competition}
                        icon={group.competitionLogo ? <img src={group.competitionLogo} alt="" className="w-4 h-4 object-contain" /> : <Clock className="w-3.5 h-3.5 text-blue-400" />}
                        titleClass="text-blue-400"
                        matches={group.matches}
                        selectedMatch={selectedMatch}
                        onSelect={setSelectedMatch}
                        onTuneToChannel={onTuneToChannel}
                        previewLimit={isPreview ? 3 : undefined}
                        onViewAll={
                          isPreview && group.matches.length > 3
                            ? () => setSelectedUpcomingFilter(group.competition)
                            : undefined
                        }
                      />
                    );
                  })}
              </div>
            )
          )}

          {/* ── RESULTS ──────────────────────────────────────────────────────── */}
          {activeTab === "results" && (
            groupedCompletedMatches.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-500 gap-3">
                <CheckCircle className="w-10 h-10 text-gray-600 shrink-0" />
                <p className="text-sm font-medium">No results yet</p>
              </div>
            ) : (
              <div className="flex flex-col gap-6 animate-fadeIn">
                {/* Competition Chips */}
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 mb-2">
                  <button
                    onClick={() => setSelectedResultsFilter("All")}
                    className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-all duration-200 shrink-0 ${
                      selectedResultsFilter === "All"
                        ? "bg-primary text-white shadow-lg shadow-primary/20 border-primary"
                        : "bg-white/5 border-white/5 text-gray-400 hover:text-white hover:bg-white/10"
                    }`}
                  >
                    All Results
                  </button>
                  {groupedCompletedMatches.map((group) => (
                    <button
                      key={group.competition}
                      onClick={() => setSelectedResultsFilter(group.competition)}
                      className={`px-4 py-1.5 flex items-center gap-2 rounded-full text-xs font-semibold whitespace-nowrap border transition-all duration-200 shrink-0 ${
                        selectedResultsFilter === group.competition
                          ? "bg-primary text-white shadow-lg shadow-primary/20 border-primary"
                          : "bg-white/5 border-white/5 text-gray-400 hover:text-white hover:bg-white/10"
                      }`}
                    >
                      {group.competitionLogo && (
                        <img src={group.competitionLogo} alt={group.competition} className="w-3.5 h-3.5 object-contain opacity-80" />
                      )}
                      {group.competition}
                    </button>
                  ))}
                </div>

                {/* Match Lists */}
                {groupedCompletedMatches
                  .filter((group) => selectedResultsFilter === "All" || group.competition === selectedResultsFilter)
                  .map((group) => {
                    const isPreview = selectedResultsFilter === "All";
                    return (
                      <MatchSection
                        key={group.competition}
                        title={group.competition}
                        icon={group.competitionLogo ? <img src={group.competitionLogo} alt="" className="w-4 h-4 object-contain grayscale opacity-60" /> : <CheckCircle className="w-3.5 h-3.5 text-gray-500" />}
                        titleClass="text-gray-500"
                        matches={group.matches}
                        selectedMatch={selectedMatch}
                        onSelect={setSelectedMatch}
                        onTuneToChannel={onTuneToChannel}
                        previewLimit={isPreview ? 3 : undefined}
                        onViewAll={
                          isPreview && group.matches.length > 3
                            ? () => setSelectedResultsFilter(group.competition)
                            : undefined
                        }
                      />
                    );
                  })}
              </div>
            )
          )}

          {/* ── STANDINGS ────────────────────────────────────────────────────── */}
          {activeTab === "standings" && (
            competitionsList.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-500 gap-3">
                <Trophy className="w-10 h-10 text-gray-600 shrink-0" />
                <p className="text-sm font-medium">No standings or knockout data available</p>
              </div>
            ) : (
              <>
                {/* Competition selector */}
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                  {competitionsList.map((compName) => {
                    return (
                      <button
                        key={compName}
                        onClick={() => setSelectedCompetition(compName)}
                        className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-all duration-200 shrink-0 ${
                          selectedCompetition === compName
                            ? "bg-primary text-white shadow-lg shadow-primary/20 border-primary"
                            : "bg-white/5 border-white/5 text-gray-400 hover:text-white hover:bg-white/10"
                        }`}
                      >
                        {compName}
                      </button>
                    );
                  })}
                </div>

                {/* ── Format-Aware Standings / Bracket ── */}
                {selectedCompetition && (() => {
                  const format = getCompetitionFormat(selectedCompetition);
                  const compStandings = standingsByCompetition[selectedCompetition] ?? [];
                  const compKnockoutMatches = matches.filter(
                    m => m.competition === selectedCompetition && m.isKnockout
                  );
                  const phase = getCompetitionPhase(
                    format,
                    compStandings.length > 0,
                    compKnockoutMatches.length > 0
                  );

                  return (
                    <div className="flex flex-col gap-6">
                      {/* ── League / Group-Phase Standings Table(s) ── */}
                      {(phase === "league_only" || phase === "league_phase" || phase === "both") && compStandings.length > 0 && (
                        <div>
                          {(phase === "both") && (
                            <div className="flex items-center gap-2 mb-3">
                              <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30 shrink-0">
                                <BarChart3 className="w-3.5 h-3.5 text-primary" />
                              </div>
                              <span className="text-xs font-bold text-primary uppercase tracking-widest">League Phase</span>
                            </div>
                          )}
                          {compStandings.length === 1 ? (
                            <StandingsTable standings={compStandings[0]} compact={false} />
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 animate-fadeIn">
                              {compStandings.map((s, idx) => (
                                <StandingsTable
                                  key={`${s.competition}-${s.groupName || idx}`}
                                  standings={s}
                                  compact={true}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* ── Knockout Stage Bracket ── */}
                      {(phase === "knockout_only" || phase === "both") && compKnockoutMatches.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center border border-amber-400/30 shrink-0">
                              <Trophy className="w-3.5 h-3.5 text-amber-400" />
                            </div>
                            <span className="text-xs font-bold text-amber-400 uppercase tracking-widest">Knockout Stage</span>
                          </div>
                          <KnockoutStageView matches={compKnockoutMatches} />
                        </div>
                      )}

                      {/* ── Empty state ── */}
                      {compStandings.length === 0 && compKnockoutMatches.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-10 text-gray-500 gap-2">
                          <BarChart3 className="w-8 h-8 text-gray-600 shrink-0" />
                          <p className="text-sm font-medium">No data available yet</p>
                        </div>
                      )}
                    </div>
                  );
                })()}

              </>
            )
          )}

          {/* ── INTERNATIONAL ─────────────────────────────────────────────── */}
          {activeTab === "international" && (
            groupedInternationalMatches.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-500 gap-3">
                <Globe className="w-10 h-10 text-gray-600 shrink-0" />
                <p className="text-sm font-medium">No international matches right now</p>
                <p className="text-xs text-gray-600">World Cup Qualifiers, Nations League &amp; continental cups will appear here when active</p>
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                {/* International header */}
                <div className="flex items-center gap-3 pb-1 border-b border-white/5">
                  <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center border border-amber-400/30 shrink-0">
                    <Globe className="w-4 h-4 text-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-sm">International Football</h3>
                    <p className="text-amber-300/70 text-xs">World Cup Qualifiers · Nations League · Continental Cups</p>
                  </div>
                </div>

                {/* Live international */}
                {internationalLive.length > 0 && (
                  <MatchSection
                    title="LIVE NOW"
                    icon={
                      <span className="relative flex h-2.5 w-2.5 mr-1">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500" />
                      </span>
                    }
                    titleClass="text-rose-400"
                    matches={internationalLive}
                    selectedMatch={selectedMatch}
                    onSelect={setSelectedMatch}
                    onTuneToChannel={onTuneToChannel}
                  />
                )}

                {/* Upcoming international */}
                {internationalUpcoming.length > 0 && (
                  <MatchSection
                    title="UPCOMING"
                    icon={<Clock className="w-3.5 h-3.5 text-amber-400" />}
                    titleClass="text-amber-400"
                    matches={internationalUpcoming}
                    selectedMatch={selectedMatch}
                    onSelect={setSelectedMatch}
                    onTuneToChannel={onTuneToChannel}
                  />
                )}

                {/* International results */}
                {internationalResults.length > 0 && (
                  <MatchSection
                    title="RESULTS"
                    icon={<CheckCircle className="w-3.5 h-3.5 text-gray-500" />}
                    titleClass="text-gray-500"
                    matches={internationalResults}
                    selectedMatch={selectedMatch}
                    onSelect={setSelectedMatch}
                    onTuneToChannel={onTuneToChannel}
                  />
                )}

                {/* Grouped by competition view */}
                {internationalLive.length === 0 && internationalUpcoming.length === 0 && internationalResults.length === 0 && groupedInternationalMatches.map((group) => (
                  <MatchSection
                    key={group.competition}
                    title={group.competition}
                    icon={<Globe className="w-3.5 h-3.5 text-amber-400" />}
                    titleClass="text-amber-400"
                    matches={group.matches}
                    selectedMatch={selectedMatch}
                    onSelect={setSelectedMatch}
                    onTuneToChannel={onTuneToChannel}
                  />
                ))}
              </div>
            )
          )}

        </motion.div>
      </AnimatePresence>

      {/* Match Detail Modal — hoisted to root level so it opens from any tab */}
      <AnimatePresence>
        {selectedMatch && (
          <MatchDetailPanel
            match={selectedMatch}
            onClose={() => setSelectedMatch(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Match Section ───────────────────────────────────────────────────────────

function MatchSection({
  title,
  icon,
  titleClass,
  matches,
  selectedMatch,
  onSelect,
  onTuneToChannel,
  previewLimit,
  onViewAll,
}: {
  title: string;
  icon: React.ReactNode;
  titleClass: string;
  matches: Match[];
  selectedMatch: Match | null;
  onSelect: (m: Match) => void;
  onTuneToChannel?: (name: string) => void;
  previewLimit?: number;
  onViewAll?: () => void;
}) {
  const displayMatches = previewLimit ? matches.slice(0, previewLimit) : matches;
  const hasMore = previewLimit ? matches.length > previewLimit : false;

  return (
    <div className="flex flex-col gap-2.5 bg-black/20 p-4 rounded-xl border border-white/5">
      <div className="flex items-center justify-between pb-2 border-b border-white/5">
        <div className="flex items-center gap-2">
          {icon}
          <span
            className={`text-[11px] font-bold uppercase tracking-widest ${titleClass}`}
          >
            {title}
          </span>
          <span className="text-[10px] text-gray-600 font-medium">
            ({matches.length})
          </span>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-1">
        {displayMatches.map((match, i) => (
          <motion.div
            key={match.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: (i % 4) * 0.05 }}
          >
            <MatchCard
              match={match}
              isSelected={selectedMatch?.id === match.id}
              onSelect={() => onSelect(match)}
              onTuneToChannel={onTuneToChannel}
            />
          </motion.div>
        ))}
      </div>
      {hasMore && onViewAll && (
        <div className="flex justify-center mt-3 border-t border-white/5 pt-4">
           <button
            onClick={onViewAll}
            className="text-[11px] font-bold uppercase tracking-wider text-primary hover:text-white transition-colors bg-primary/10 border border-primary/20 hover:bg-primary/30 px-6 py-2 rounded-full flex items-center gap-2"
          >
            View All {matches.length} Matches <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Match Card ──────────────────────────────────────────────────────────────

function MatchCard({
  match,
  isSelected,
  onSelect,
  onTuneToChannel,
}: {
  match: Match;
  isSelected: boolean;
  onSelect: () => void;
  onTuneToChannel?: (name: string) => void;
}) {
  const isLive = match.status === "LIVE" || match.status === "HT";
  const isFT = match.status === "FT";
  const isScheduled = match.status === "SCHEDULED";

  const homeIsWinner = match.homeWinner || match.homeAdvance || (match.homeScore > match.awayScore && !match.awayWinner && !match.awayAdvance);
  const awayIsWinner = match.awayWinner || match.awayAdvance || (match.awayScore > match.homeScore && !match.homeWinner && !match.homeAdvance);

  const homeGoals = match.events.filter((e) => e.type === "goal" && e.team === "home");
  const awayGoals = match.events.filter((e) => e.type === "goal" && e.team === "away");

  const renderScorersList = (goals: typeof match.events, align: "left" | "right") => {
    const grouped: Record<string, number[]> = {};
    goals.forEach((g) => {
      const scorerName = g.detail || "";
      if (!scorerName) return;
      if (!grouped[scorerName]) {
        grouped[scorerName] = [];
      }
      grouped[scorerName].push(g.minute);
    });

    return (
      <div className={`flex flex-col gap-0.5 mt-1.5 w-full ${align === "right" ? "items-end text-right" : "items-start text-left"}`}>
        {Object.entries(grouped).map(([scorer, mins]) => (
          <span
            key={scorer}
            className="text-[10px] text-gray-400 select-none flex items-center gap-1.5 max-w-full truncate"
          >
            <SoccerBallIcon className="w-2.5 h-2.5 text-gray-500 shrink-0" />
            <span className="truncate">{scorer} {mins.map((m) => `${m}'`).join(", ")}</span>
          </span>
        ))}
      </div>
    );
  };

  return (
    <div
      role="button"
      tabIndex={-1}
      onClick={onSelect}
      className={`w-full text-left rounded-2xl transition-all duration-300 cursor-pointer overflow-hidden outline-none
        ${isLive
          ? "bg-gradient-to-br from-rose-950/25 to-black/70 border border-rose-500/30 hover:border-rose-500/50 shadow-[0_4px_24px_rgba(244,63,94,0.06)]"
          : isFT
          ? "bg-gradient-to-br from-slate-900/50 to-black/70 border border-white/5 hover:border-white/10 hover:bg-slate-900/60 shadow-md"
          : "bg-gradient-to-br from-blue-950/15 to-black/70 border border-blue-500/20 hover:border-blue-500/35 hover:bg-blue-950/20 shadow-[0_4px_24px_rgba(59,130,246,0.04)]"}
        ${isSelected 
          ? "ring-2 ring-primary scale-[1.02] shadow-[0_0_24px_rgba(27,226,27,0.3)] bg-gradient-to-br from-slate-900/80 to-black/90" 
          : "hover:scale-[1.01] focus-within:scale-[1.02] focus-within:ring-2 focus-within:ring-primary focus-within:shadow-[0_0_24px_rgba(27,226,27,0.3)]"}`}
    >
      {/* ── Top Header: Competition Logo, Name and Match Status ── */}
      <div
        className={`flex items-center justify-between px-4 py-2.5 border-b backdrop-blur-sm
          ${isLive ? "border-rose-500/10 bg-rose-500/[0.02]" : isFT ? "border-white/[0.03] bg-white/[0.01]" : "border-blue-500/[0.08] bg-blue-500/[0.01]"}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {match.competitionLogo && (
            <img
              src={match.competitionLogo}
              alt=""
              className="w-4 h-4 rounded-sm object-contain shrink-0 opacity-80"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          )}
          <span className="text-[10px] text-gray-400 font-bold tracking-wider truncate uppercase">
            {match.competition}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isLive && (
            <span className="flex h-1.5 w-1.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-500" />
            </span>
          )}
          <StatusBadge status={match.status} elapsed={match.elapsedDisplay} />
        </div>
      </div>

      {/* ── Main Scorecard Body ── */}
      <div className="px-3 sm:px-5 py-4 sm:py-5">

        {/* ── Mobile Layout: vertical stack (< sm) ── */}
        <div className="flex sm:hidden flex-col gap-2.5">

          {/* Home Team Row */}
          <div className="flex items-center gap-2.5 min-w-0">
            <TeamLogo src={match.homeLogo} name={match.homeTeam} size={28} />
            <span
              className={`flex-1 text-sm font-extrabold text-white leading-snug min-w-0
                ${isFT && !homeIsWinner && awayIsWinner ? "opacity-50" : ""}`}
            >
              {match.homeTeam}
            </span>
            {!isScheduled && (
              <div className="flex items-baseline gap-1 shrink-0 ml-1">
                <ScoreDisplay
                  value={match.homeScore}
                  winning={homeIsWinner}
                  className="text-2xl font-black"
                />
                {match.homePenaltyScore !== undefined && (
                  <span className="text-xs font-bold text-gray-400">({match.homePenaltyScore})</span>
                )}
              </div>
            )}
          </div>
          {homeGoals.length > 0 && (
            <div className="pl-9 -mt-1.5 mb-1">
              {renderScorersList(homeGoals, "left")}
            </div>
          )}

          {/* Separator / scheduled time */}
          <div className="flex items-center gap-2 px-1">
            <div className="flex-1 h-px bg-white/[0.06]" />
            {isScheduled ? (
              <div className="flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 rounded-lg">
                <Clock className="w-3 h-3 text-blue-400 shrink-0" />
                <span className="text-xs font-black text-blue-300 tabular-nums">
                  {new Date(match.startTime).toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "Asia/Dhaka",
                    hour12: true,
                  })}
                </span>
              </div>
            ) : (
              <span className="text-[10px] font-bold text-white/25 tracking-widest uppercase px-2 select-none">
                vs
              </span>
            )}
            <div className="flex-1 h-px bg-white/[0.06]" />
          </div>

          {/* Away Team Row */}
          <div className="flex items-center gap-2.5 min-w-0">
            <TeamLogo src={match.awayLogo} name={match.awayTeam} size={28} />
            <span
              className={`flex-1 text-sm font-extrabold text-white leading-snug min-w-0
                ${isFT && !awayIsWinner && homeIsWinner ? "opacity-50" : ""}`}
            >
              {match.awayTeam}
            </span>
            {!isScheduled && (
              <div className="flex items-baseline gap-1 shrink-0 ml-1">
                <ScoreDisplay
                  value={match.awayScore}
                  winning={awayIsWinner}
                  className="text-2xl font-black"
                />
                {match.awayPenaltyScore !== undefined && (
                  <span className="text-xs font-bold text-gray-400">({match.awayPenaltyScore})</span>
                )}
              </div>
            )}
          </div>
          {awayGoals.length > 0 && (
            <div className="pl-9 -mt-1.5 mb-1">
              {renderScorersList(awayGoals, "left")}
            </div>
          )}
        </div>

        {/* ── Desktop Layout: horizontal TV layout (sm+) ── */}
        <div className="hidden sm:flex items-center justify-between gap-4">

          {/* Home Team */}
          <div className="flex-1 flex flex-col items-end min-w-0">
            <div className="flex items-center justify-end gap-3 w-full min-w-0">
              <span
                className={`text-base font-extrabold text-white text-right truncate
                  ${isFT && !homeIsWinner && awayIsWinner ? "opacity-50" : ""}`}
              >
                {match.homeTeam}
              </span>
              <TeamLogo src={match.homeLogo} name={match.homeTeam} size={32} />
            </div>
            {homeGoals.length > 0 && renderScorersList(homeGoals, "right")}
          </div>

          {/* Center: Main Score / Time block */}
          <div className="flex flex-col items-center justify-center shrink-0 min-w-[120px]">
            {isScheduled ? (
              <div className="flex flex-col items-center justify-center bg-blue-500/10 border border-blue-500/20 px-3 py-1.5 rounded-xl">
                <Clock className="w-4 h-4 text-blue-400 mb-1" />
                <span className="text-sm font-black text-blue-300 tabular-nums">
                  {new Date(match.startTime).toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "Asia/Dhaka",
                    hour12: true,
                  })}
                </span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-3 bg-black/40 px-4 py-2 rounded-xl border border-white/5 shadow-inner">
                <div className="flex items-baseline gap-1">
                  <ScoreDisplay
                    value={match.homeScore}
                    winning={homeIsWinner}
                    className="text-3xl font-black"
                  />
                  {match.homePenaltyScore !== undefined && (
                    <span className="text-sm font-bold text-gray-400">({match.homePenaltyScore})</span>
                  )}
                </div>
                <span className="text-white/20 font-bold text-lg select-none">:</span>
                <div className="flex items-baseline gap-1">
                  <ScoreDisplay
                    value={match.awayScore}
                    winning={awayIsWinner}
                    className="text-3xl font-black"
                  />
                  {match.awayPenaltyScore !== undefined && (
                    <span className="text-sm font-bold text-gray-400">({match.awayPenaltyScore})</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Away Team */}
          <div className="flex-1 flex flex-col items-start min-w-0">
            <div className="flex items-center justify-start gap-3 w-full min-w-0">
              <TeamLogo src={match.awayLogo} name={match.awayTeam} size={32} />
              <span
                className={`text-base font-extrabold text-white text-left truncate
                  ${isFT && !awayIsWinner && homeIsWinner ? "opacity-50" : ""}`}
              >
                {match.awayTeam}
              </span>
            </div>
            {awayGoals.length > 0 && renderScorersList(awayGoals, "left")}
          </div>
        </div>
      </div>

      {/* ── Premium Footer ── */}
      <div
        className={`flex items-center justify-between px-5 py-2.5 border-t backdrop-blur-sm
          ${isLive ? "border-rose-500/10 bg-rose-500/[0.01]" : isFT ? "border-white/[0.03] bg-white/[0.01]" : "border-blue-500/[0.08] bg-blue-500/[0.01]"}`}
      >
        {/* Date, Time & Venue */}
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-[11px] text-gray-400 font-medium">
            {formatMatchDate(match.startTime)}
          </span>
          {match.venue && (
            <span className="text-[10px] text-gray-500 flex items-center gap-1 truncate max-w-[140px] md:max-w-[180px]">
              <MapPin className="w-3 h-3 text-gray-500 shrink-0" />
              {match.venue}
            </span>
          )}
        </div>

        {/* Dynamic primary & secondary TV actions */}
        <div className="flex items-center gap-2 shrink-0">
          {isLive && match.broadcasterRecommendation && onTuneToChannel && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTuneToChannel(match.broadcasterRecommendation!);
              }}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold text-white
                bg-gradient-to-r from-primary to-[#7df36b] hover:from-[#048d1f] hover:to-[#4efc04]
                focus-visible:from-[#048d1f] focus-visible:to-[#4efc04] focus-visible:ring-2 focus-visible:ring-white
                shadow-md shadow-primary/20 transition-all duration-200 cursor-pointer active:scale-95 border-none outline-none"
            >
              <Play className="w-2.5 h-2.5" fill="currentColor" />
              Watch
            </button>
          )}
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelect();
            }}
            className="flex items-center gap-0.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold text-white/70 bg-white/5 hover:bg-white/10 hover:text-white focus-visible:bg-white/20 focus-visible:text-white transition-all cursor-pointer border border-white/5 outline-none"
          >
            {isFT ? "View Details" : "Match Details"}
            <ChevronRight className="w-3 h-3 text-gray-500" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Match Detail Panel ──────────────────────────────────────────────────────

function MatchDetailPanel({
  match,
  onClose,
}: {
  match: Match;
  onClose: () => void;
}) {
  const [detailData, setDetailData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<"timeline" | "stats" | "lineups">("timeline");

  // Determine if it is an international tournament to use neutral styling
  const isInternational = useMemo(() => {
    const comp = match.competition.toLowerCase();
    return (
      comp.includes("world cup") ||
      comp.includes("euro") ||
      comp.includes("copa america") ||
      comp.includes("fifa") ||
      comp.includes("national") ||
      comp.includes("friendly")
    );
  }, [match.competition]);

  const fetchDetails = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const res = await fetch(`/api/football?matchId=${match.id}&league=${match.leagueSlug}`);
      if (!res.ok) throw new Error("Failed to load match details");
      const data = await res.json();
      setDetailData(data);
      setError(null);
    } catch (err: any) {
      console.error(err);
      if (!isSilent) setError(err.message || "Error loading details");
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [match.id, match.leagueSlug]);

  // Stable interval ref — cleared and restarted whenever match.status changes
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Always fetch immediately on open or status change
    fetchDetails();

    // Clear any existing interval before (re)starting
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Poll every 10 seconds while the match is live or at half-time
    const isLive = match.status === "LIVE" || match.status === "HT";
    if (isLive) {
      intervalRef.current = setInterval(() => {
        fetchDetails(true);
      }, 10_000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  // Re-run whenever the match id, slug or live status changes
  }, [fetchDetails, match.id, match.leagueSlug, match.status]);

  const renderScorersList = (goals: any[], align: "left" | "right") => {
    const grouped: Record<string, number[]> = {};
    goals.forEach((g: any) => {
      const scorerName = g.detail || "";
      if (!scorerName) return;
      if (!grouped[scorerName]) {
        grouped[scorerName] = [];
      }
      grouped[scorerName].push(g.minute);
    });

    return (
      <div className={`flex flex-col gap-0.5 mt-1 ${align === "right" ? "items-end text-right" : "items-start text-left"}`}>
        {Object.entries(grouped).map(([scorer, mins]) => (
          <span
            key={scorer}
            className="text-[11px] text-gray-400 select-none flex items-center gap-1.5"
          >
            <SoccerBallIcon className="w-3 h-3 text-gray-500 shrink-0" />
            <span>{scorer} {mins.map((m) => `${m}'`).join(", ")}</span>
          </span>
        ))}
      </div>
    );
  };

  const getGoalsForTeam = (team: "home" | "away") => {
    const events = detailData?.events || match.events || [];
    return events.filter((e: any) => e.type === "goal" && e.team === team);
  };

  const homeGoals = getGoalsForTeam("home");
  const awayGoals = getGoalsForTeam("away");

  const getModalStatusBadge = () => {
    const status = detailData?.status || match.status;
    const elapsedDisplay = detailData?.elapsedDisplay || match.elapsedDisplay;
    
    if (status === "LIVE") {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/20 text-rose-400 text-xs font-bold uppercase tracking-wider animate-pulse">
          <span className="h-2 w-2 rounded-full bg-rose-500" />
          LIVE · {elapsedDisplay}
        </span>
      );
    }
    if (status === "HT") {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold uppercase tracking-wider">
          HT
        </span>
      );
    }
    if (status === "FT") {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-gray-400 text-xs font-bold uppercase tracking-wider">
          FT
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs font-bold uppercase tracking-wider">
        UPCOMING
      </span>
    );
  };

  const eventIcon = (type: string, detail: string) => {
    switch (type) {
      case "goal":
        return <SoccerBallIcon className="w-3.5 h-3.5 text-white shrink-0" />;
      case "yellow-card":
        return <RefCard color="yellow" />;
      case "red-card":
        return <RefCard color="red" />;
      case "card":
        return detail.toLowerCase().includes("red") ? <RefCard color="red" /> : <RefCard color="yellow" />;
      case "sub":
        return <ArrowLeftRight className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
      default:
        return <Clock className="w-3.5 h-3.5 text-blue-400 shrink-0" />;
    }
  };

  const renderTimelineTab = () => {
    const events = detailData.events || [];
    if (events.length === 0) {
      return (
        <div className="text-center py-12 text-gray-500 text-xs bg-white/[0.01] rounded-xl border border-white/[0.03]">
          No live events recorded for this match yet.
        </div>
      );
    }

    return (
      <div className="relative py-4">
        {/* Central timeline line */}
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/[0.08] -translate-x-1/2" />

        <div className="space-y-4">
          {events.map((event: any, i: number) => {
            const isHome = event.team === "home";
            const icon = eventIcon(event.type, event.detail);

            return (
              <motion.div
                key={`${event.minute}-${event.type}-${i}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: Math.min(i * 0.05, 0.4) }}
                className={`flex items-center w-full ${isHome ? "flex-row" : "flex-row-reverse"}`}
              >
                {/* Content side */}
                <div className={`w-[45%] flex ${isHome ? "justify-end text-right" : "justify-start text-left"} items-center gap-2.5 px-3`}>
                  <div className={`flex flex-col min-w-0 ${isHome ? "items-end" : "items-start"}`}>
                    <span className="text-xs font-bold text-white truncate max-w-full">
                      {event.detail}
                    </span>
                  </div>
                </div>

                {/* Minute badge in center line */}
                <div className="w-[10%] flex justify-center z-10">
                  <span className="flex items-center justify-center w-7 h-7 rounded-full bg-slate-900 border border-white/10 text-[9px] font-black text-primary font-mono shadow-md">
                    {event.clockDisplay || `${event.minute}'`}
                  </span>
                </div>

                {/* Icon side */}
                <div className={`w-[45%] flex ${isHome ? "justify-start" : "justify-end"} px-3 text-lg`}>
                  <span className="inline-flex p-1.5 rounded-lg bg-white/5 border border-white/5 shadow-sm">
                    {icon}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderStatsTab = () => {
    const stats = detailData.stats;
    if (!stats || (!stats.home && !stats.away)) {
      return (
        <div className="text-center py-12 text-gray-500 text-xs bg-white/[0.01] rounded-xl border border-white/[0.03]">
          Detailed match statistics are not available.
        </div>
      );
    }

    const homeStats = stats.home;
    const awayStats = stats.away;

    const statRows = [
      { label: "Ball Possession", home: homeStats.possession, away: awayStats.possession, isPct: true },
      { label: "Total Shots", home: homeStats.shots, away: awayStats.shots },
      { label: "Shots on Target", home: homeStats.shotsOnTarget, away: awayStats.shotsOnTarget },
      { label: "Passes", home: homeStats.passes, away: awayStats.passes },
      { label: "Pass Accuracy", home: homeStats.passAccuracy, away: awayStats.passAccuracy, isPct: true },
      { label: "Corner Kicks", home: homeStats.corners, away: awayStats.corners },
      { label: "Fouls Committed", home: homeStats.fouls, away: awayStats.fouls },
      { label: "Yellow Cards", home: homeStats.yellowCards, away: awayStats.yellowCards },
      { label: "Red Cards", home: homeStats.redCards, away: awayStats.redCards },
      { label: "Saves", home: homeStats.saves, away: awayStats.saves },
    ];

    return (
      <div className="space-y-4 py-2 px-1">
        {/* Header names */}
        <div className="flex items-center justify-between text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-2 select-none">
          <span className="max-w-[40%] truncate">{match.homeTeam}</span>
          <span>VS</span>
          <span className="max-w-[40%] truncate">{match.awayTeam}</span>
        </div>

        {statRows.map((row) => {
          const total = row.home + row.away || 1;
          const homePct = (row.home / total) * 100;
          const awayPct = (row.away / total) * 100;

          return (
            <div key={row.label} className="space-y-1">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-white">
                  {row.home}{row.isPct ? "%" : ""}
                </span>
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                  {row.label}
                </span>
                <span className="text-white">
                  {row.away}{row.isPct ? "%" : ""}
                </span>
              </div>
              <div className="flex h-2 rounded-full overflow-hidden bg-white/5 gap-0.5">
                <motion.div
                  className="bg-primary rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${homePct}%` }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                />
                <motion.div
                  className="bg-rose-500 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${awayPct}%` }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                />
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderLineupsTab = () => {
    const lineups = detailData.lineups;
    if (!lineups || (!lineups.home && !lineups.away)) {
      return (
        <div className="text-center py-12 text-gray-500 text-xs bg-white/[0.01] rounded-xl border border-white/[0.03]">
          Lineups are not available for this match.
        </div>
      );
    }

    const homeLineup = lineups.home;
    const awayLineup = lineups.away;

    return (
      <div className="space-y-6 py-2 px-1">
        {/* Formations Header */}
        <div className="flex items-center justify-between text-xs font-extrabold text-white bg-white/5 border border-white/5 rounded-xl px-4 py-2 select-none">
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Formation</span>
            <span className="text-primary font-black text-sm">{homeLineup.formation || "N/A"}</span>
          </div>
          <span className="text-gray-500 font-bold uppercase tracking-widest text-[9px]">TACTICAL SHEETS</span>
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Formation</span>
            <span className="text-rose-400 font-black text-sm">{awayLineup.formation || "N/A"}</span>
          </div>
        </div>

        {/* Starters Section */}
        <div className="space-y-3">
          <h5 className="text-[10px] font-black text-gray-500 uppercase tracking-wider border-b border-white/5 pb-1">
            STARTING XI
          </h5>
          <div className="grid grid-cols-2 gap-4">
            {/* Home Starters */}
            <div className="space-y-2">
              {homeLineup.starters.length === 0 ? (
                <span className="text-xs text-gray-500">No data</span>
              ) : (
                homeLineup.starters.map((p: any) => (
                  <div key={p.id} className="flex items-center gap-2 text-xs py-1 px-1.5 rounded-lg hover:bg-white/[0.02] transition-colors">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 border border-primary/20 text-[9px] font-bold text-primary font-mono shrink-0 select-none">
                      {p.jersey}
                    </span>
                    <div className="flex flex-col min-w-0">
                      <span className="font-bold text-white truncate">{p.name}</span>
                      <span className="text-[9px] text-gray-500 font-medium uppercase tracking-wider truncate">{p.position}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Away Starters */}
            <div className="space-y-2">
              {awayLineup.starters.length === 0 ? (
                <span className="text-xs text-gray-500">No data</span>
              ) : (
                awayLineup.starters.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-end gap-2 text-xs py-1 px-1.5 rounded-lg hover:bg-white/[0.02] transition-colors text-right">
                    <div className="flex flex-col min-w-0 items-end">
                      <span className="font-bold text-white truncate">{p.name}</span>
                      <span className="text-[9px] text-gray-500 font-medium uppercase tracking-wider truncate">{p.position}</span>
                    </div>
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-rose-500/10 border border-rose-500/20 text-[9px] font-bold text-rose-400 font-mono shrink-0 select-none">
                      {p.jersey}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Substitutes Section */}
        <div className="space-y-3">
          <h5 className="text-[10px] font-black text-gray-500 uppercase tracking-wider border-b border-white/5 pb-1">
            SUBSTITUTES / BENCH
          </h5>
          <div className="grid grid-cols-2 gap-4">
            {/* Home Substitutes */}
            <div className="space-y-2">
              {homeLineup.bench.length === 0 ? (
                <span className="text-xs text-gray-500">No data</span>
              ) : (
                homeLineup.bench.map((p: any) => (
                  <div key={p.id} className="flex items-center gap-2 text-xs py-1 px-1.5 rounded-lg hover:bg-white/[0.02] transition-colors">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-white/5 border border-white/10 text-[9px] font-bold text-gray-400 font-mono shrink-0 select-none">
                      {p.jersey}
                    </span>
                    <div className="flex flex-col min-w-0">
                      <span className="font-semibold text-gray-300 truncate">{p.name}</span>
                      <span className="text-[9px] text-gray-500 truncate">{p.position}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Away Substitutes */}
            <div className="space-y-2">
              {awayLineup.bench.length === 0 ? (
                <span className="text-xs text-gray-500">No data</span>
              ) : (
                awayLineup.bench.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-end gap-2 text-xs py-1 px-1.5 rounded-lg hover:bg-white/[0.02] transition-colors text-right">
                    <div className="flex flex-col min-w-0 items-end">
                      <span className="font-semibold text-gray-300 truncate">{p.name}</span>
                      <span className="text-[9px] text-gray-500 truncate">{p.position}</span>
                    </div>
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-white/5 border border-white/10 text-[9px] font-bold text-gray-400 font-mono shrink-0 select-none">
                      {p.jersey}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    // Backdrop — covers full screen including safe areas, scrollable on very small screens
    <div
      className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 overflow-y-auto"
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
      onClick={onClose}
    >
      {/* Centering wrapper */}
      <div className="min-h-full flex items-center justify-center p-3 sm:p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="relative bg-gradient-to-b from-slate-900/95 via-black/95 to-black border border-white/10 rounded-3xl w-full max-w-2xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Sticky Modal Header — always visible, never scrolls away ── */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 pt-4 pb-3 shrink-0 bg-slate-900/95 backdrop-blur-sm border-b border-white/[0.06] rounded-t-3xl">
          <div className="flex items-center gap-2.5 min-w-0">
            <Trophy className="w-4 h-4 text-primary shrink-0" />
            <span className="text-xs font-extrabold text-white uppercase tracking-wider truncate">
              {match.competition}
            </span>
            <span className="shrink-0">{getModalStatusBadge()}</span>
          </div>
          {/* Close button — always visible, large enough tap target for mobile */}
          <button
            onClick={onClose}
            className="ml-3 shrink-0 flex items-center justify-center w-8 h-8 rounded-xl bg-white/5 hover:bg-white/15 active:bg-white/20 text-gray-300 hover:text-white transition-colors cursor-pointer border border-white/10 outline-none"
            aria-label="Close details"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {/* Scrollable body */}
        <div className="flex flex-col overflow-y-auto max-h-[calc(90vh-56px)] custom-scrollbar px-5 pt-4 pb-6 gap-5">

        {/* Score Banner */}
        <div className="flex flex-col gap-3 py-4 px-5 bg-white/[0.02] border border-white/5 rounded-2xl mb-5 shrink-0">
          <div className="flex items-center justify-between gap-4">
            {/* Team 1 name/logo */}
            <div className="flex-1 flex items-center justify-end gap-3 min-w-0">
              <span className="text-sm sm:text-lg font-black text-white text-right truncate">
                {match.homeTeam}
              </span>
              <TeamLogo src={match.homeLogo} name={match.homeTeam} size={44} />
            </div>

            {/* Score */}
            <div className="flex items-center gap-4 shrink-0 px-4 py-2 bg-black/45 rounded-2xl border border-white/5 shadow-inner">
              {match.status === "SCHEDULED" ? (
                <div className="flex flex-col items-center">
                  <Clock className="w-4 h-4 text-blue-400 mb-0.5" />
                  <span className="text-sm font-black text-blue-300 tabular-nums">
                    {new Date(match.startTime).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Dhaka", hour12: true })}
                  </span>
                </div>
              ) : (
                <>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl sm:text-4xl font-black text-white tabular-nums">
                      {detailData?.homeScore ?? match.homeScore}
                    </span>
                    {(detailData?.homePenaltyScore ?? match.homePenaltyScore) !== undefined && (
                      <span className="text-base font-bold text-gray-400">({detailData?.homePenaltyScore ?? match.homePenaltyScore})</span>
                    )}
                  </div>
                  <span className="text-xl text-gray-600 font-bold select-none">-</span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl sm:text-4xl font-black text-white tabular-nums">
                      {detailData?.awayScore ?? match.awayScore}
                    </span>
                    {(detailData?.awayPenaltyScore ?? match.awayPenaltyScore) !== undefined && (
                      <span className="text-base font-bold text-gray-400">({detailData?.awayPenaltyScore ?? match.awayPenaltyScore})</span>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Team 2 name/logo */}
            <div className="flex-1 flex items-center justify-start gap-3 min-w-0">
              <TeamLogo src={match.awayLogo} name={match.awayTeam} size={44} />
              <span className="text-sm sm:text-lg font-black text-white text-left truncate">
                {match.awayTeam}
              </span>
            </div>
          </div>

          {/* Goal Scorers list (Vertical new lines) */}
          {(homeGoals.length > 0 || awayGoals.length > 0) && (
            <div className="grid grid-cols-2 gap-6 border-t border-white/5 pt-2.5 mt-1">
              <div className="flex flex-col items-end">
                {homeGoals.length > 0 && renderScorersList(homeGoals, "right")}
              </div>
              <div className="flex flex-col items-start">
                {awayGoals.length > 0 && renderScorersList(awayGoals, "left")}
              </div>
            </div>
          )}
        </div>

        {/* Tab Selection */}
        <div className="flex gap-1 p-1 rounded-xl bg-white/5 shrink-0">
          {[
            { id: "timeline", label: "Timeline", icon: <Activity className="w-3.5 h-3.5" /> },
            { id: "stats", label: "Statistics", icon: <BarChart3 className="w-3.5 h-3.5" /> },
            { id: "lineups", label: "Lineups", icon: <Users className="w-3.5 h-3.5" /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-extrabold transition-all border-none bg-transparent outline-none cursor-pointer ${
                activeSubTab === tab.id
                  ? "bg-primary text-white shadow-lg"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="space-y-4">
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 text-gray-500 gap-3">
              <RefreshCw className="w-8 h-8 animate-spin text-primary" />
              <p className="text-xs font-semibold">Loading match details...</p>
            </div>
          )}

          {error && !detailData && (
            <div className="flex flex-col items-center justify-center py-12 text-rose-400 text-center px-4 gap-2">
              <span className="text-2xl">⚠️</span>
              <p className="text-sm font-semibold">{error}</p>
              <button
                onClick={() => fetchDetails()}
                className="mt-2 px-4 py-1.5 bg-primary/20 hover:bg-primary/30 border border-primary/30 rounded-lg text-xs font-bold text-white cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}

          {!loading && detailData && (
            <>
              {activeSubTab === "timeline" && renderTimelineTab()}
              {activeSubTab === "stats" && renderStatsTab()}
              {activeSubTab === "lineups" && renderLineupsTab()}
            </>
          )}
        </div>

        {/* Footer info (Venue/Officials) */}
        {detailData && (detailData.venue || (detailData.officials && detailData.officials.length > 0)) && (
          <div className="border-t border-white/5 pt-3.5 text-[10px] text-gray-500 flex flex-wrap gap-4 justify-between items-center">
            {detailData.venue && (
              <span className="flex items-center gap-1 font-medium">
                <MapPin className="w-3.5 h-3.5 text-gray-500" />
                Venue: <span className="text-gray-400 font-bold">{detailData.venue}</span>
              </span>
            )}
            {detailData.officials && detailData.officials.length > 0 && (
              <span className="flex items-center gap-1 font-medium">
                Referee: <span className="text-gray-400 font-bold">{detailData.officials[0]}</span>
              </span>
            )}
          </div>
        )}
        </div>{/* end scrollable body */}
      </motion.div>
      </div>{/* end centering wrapper */}
    </div>
  );
}

// ─── Knockout Stage Components ─────────────────────────────────────────────────

// ── Aggregate score computation for two-legged ties ──────────────────────────
// In leg 2, the "home" team is actually the "away" team from leg 1's perspective.
// We always return scores from the perspective of the leg-1 home team.
function computeAggregate(leg1: Match, leg2: Match | null): {
  team1Name: string; team1Logo: string; team1Agg: number;
  team2Name: string; team2Logo: string; team2Agg: number;
  winner: "team1" | "team2" | null;
} {
  const team1Name = leg1.homeTeam;
  const team1Logo = leg1.homeLogo;
  const team2Name = leg1.awayTeam;
  const team2Logo = leg1.awayLogo;

  // Leg 1: team1 is home
  const leg1Team1 = leg1.status !== "SCHEDULED" ? leg1.homeScore : 0;
  const leg1Team2 = leg1.status !== "SCHEDULED" ? leg1.awayScore : 0;

  // Leg 2: team1 is now away (positions are flipped)
  let leg2Team1 = 0;
  let leg2Team2 = 0;
  if (leg2 && leg2.status !== "SCHEDULED") {
    // In leg 2 the leg-1 away team is at home, so leg2.homeScore → team2's leg2 goals
    leg2Team1 = leg2.awayScore;
    leg2Team2 = leg2.homeScore;
  }

  const team1Agg = leg1Team1 + leg2Team1;
  const team2Agg = leg1Team2 + leg2Team2;

  // Determine winner: check advance flags first (handles away goals / pens)
  let winner: "team1" | "team2" | null = null;
  if (leg2 && leg2.status === "FT") {
    // Try advance flags from leg 2 (the decisive leg)
    if (leg2.awayAdvance || leg2.awayWinner) winner = "team1";     // leg2 away = leg1 home = team1
    else if (leg2.homeAdvance || leg2.homeWinner) winner = "team2";
    else if (team1Agg > team2Agg) winner = "team1";
    else if (team2Agg > team1Agg) winner = "team2";
  } else if (leg1.status === "FT" && !leg2) {
    // Single-leg in a two-legged slot shouldn't happen but safe fallback
    if (team1Agg > team2Agg) winner = "team1";
    else if (team2Agg > team1Agg) winner = "team2";
  }

  return { team1Name, team1Logo, team1Agg, team2Name, team2Logo, team2Agg, winner };
}

// ── Two-legged tie card ───────────────────────────────────────────────────────
function TwoLeggedTieCard({ tie }: { tie: KnockoutTie }) {
  const { leg1, leg2, roundName } = tie;
  if (!leg1) return null;

  const agg = computeAggregate(leg1, leg2);
  const isLive = leg1.status === "LIVE" || leg2?.status === "LIVE";
  const bothPlayed = leg1.status === "FT" && leg2?.status === "FT";
  const leg2Pending = leg2 === null || leg2.status === "SCHEDULED";
  const hasPenalties = bothPlayed && (
    leg2?.homePenaltyScore !== undefined || leg2?.awayPenaltyScore !== undefined
  );

  const renderLegRow = (leg: Match, label: string) => {
    const isLegLive = leg.status === "LIVE" || leg.status === "HT";
    const isPlayed = leg.status === "FT" || leg.status === "HT";
    return (
      <div className={`flex items-center gap-2 px-3 py-2 border-b border-white/[0.04] ${isLegLive ? "bg-rose-950/30" : ""}`}>
        <span className={`text-[9px] font-black uppercase tracking-widest w-8 shrink-0 ${isLegLive ? "text-rose-400" : "text-gray-500"}`}>
          {label}
        </span>
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <TeamLogo src={leg.homeLogo} name={leg.homeTeam} size={14} />
          <span className="text-xs text-gray-300 truncate">{leg.homeTeam}</span>
        </div>
        {isPlayed || isLegLive ? (
          <span className="text-xs font-black tabular-nums text-white shrink-0 w-8 text-center">
            {leg.homeScore} – {leg.awayScore}
          </span>
        ) : (
          <span className="text-[10px] text-gray-600 font-semibold shrink-0 w-16 text-center">
            {formatMatchDate(leg.startTime)}
          </span>
        )}
        <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
          <span className="text-xs text-gray-300 truncate text-right">{leg.awayTeam}</span>
          <TeamLogo src={leg.awayLogo} name={leg.awayTeam} size={14} />
        </div>
        {isLegLive && (
          <span className="text-[9px] font-bold text-rose-400 shrink-0 ml-1">{leg.elapsedDisplay}</span>
        )}
      </div>
    );
  };

  return (
    <div className={`flex flex-col rounded-2xl overflow-hidden shadow-xl border transition-all duration-300 hover:scale-[1.01]
      ${isLive
        ? "bg-gradient-to-br from-rose-950/60 to-black border-rose-500/40 ring-1 ring-rose-500/20"
        : "bg-gradient-to-br from-slate-900/80 to-black border-slate-700/40"
      }
    `}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-white/[0.03] border-b border-white/[0.06] text-[10px] font-bold">
        <span className="text-gray-500 uppercase tracking-wider truncate">{roundName}</span>
        {isLive ? (
          <span className="flex items-center gap-1 text-rose-400">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />LIVE
          </span>
        ) : bothPlayed ? (
          <span className="text-gray-500">FT · Agg</span>
        ) : (
          <span className="text-blue-400/70">2 Legs</span>
        )}
      </div>

      {/* Legs */}
      {renderLegRow(leg1, "Leg 1")}
      {leg2 ? renderLegRow(leg2, "Leg 2") : (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.04] opacity-40">
          <span className="text-[9px] font-black uppercase tracking-widest w-8 text-gray-500">Leg 2</span>
          <span className="text-xs text-gray-600 italic">To be played</span>
        </div>
      )}

      {/* Aggregate Row */}
      <div className={`flex items-center justify-between px-3 py-2.5
        ${agg.winner ? "bg-gradient-to-r from-primary/5 to-transparent" : "bg-white/[0.02]"}
      `}>
        {/* Team 1 */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <TeamLogo src={agg.team1Logo} name={agg.team1Name} size={18} />
          <div className="min-w-0">
            <p className={`text-xs font-bold truncate ${agg.winner === "team1" ? "text-primary" : "text-white/80"}`}>
              {agg.team1Name}
            </p>
            <p className="text-[9px] text-gray-500 font-medium">Aggregate</p>
          </div>
          {agg.winner === "team1" && <CheckCircle className="w-3.5 h-3.5 text-primary shrink-0" />}
        </div>

        {/* Agg score */}
        <div className="flex items-center gap-2 shrink-0 px-3">
          <span className={`text-lg font-black tabular-nums ${agg.winner === "team1" ? "text-primary" : "text-white"}`}>
            {agg.team1Agg}
          </span>
          <span className="text-gray-600 font-bold">–</span>
          <span className={`text-lg font-black tabular-nums ${agg.winner === "team2" ? "text-primary" : "text-white"}`}>
            {agg.team2Agg}
          </span>
        </div>

        {/* Team 2 */}
        <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
          {agg.winner === "team2" && <CheckCircle className="w-3.5 h-3.5 text-primary shrink-0" />}
          <div className="min-w-0 text-right">
            <p className={`text-xs font-bold truncate ${agg.winner === "team2" ? "text-primary" : "text-white/80"}`}>
              {agg.team2Name}
            </p>
            <p className="text-[9px] text-gray-500 font-medium">Aggregate</p>
          </div>
          <TeamLogo src={agg.team2Logo} name={agg.team2Name} size={18} />
        </div>
      </div>

      {/* Penalties footer */}
      {hasPenalties && (
        <div className="px-3 py-1 text-center text-[10px] font-bold text-amber-400 bg-amber-500/5 border-t border-amber-500/10 tracking-wide">
          Decided on Penalties
        </div>
      )}

      {/* Leg 2 pending banner */}
      {leg2Pending && leg1.status === "FT" && (
        <div className="px-3 py-1.5 text-center text-[10px] font-bold text-blue-400 bg-blue-500/5 border-t border-blue-500/10 tracking-wide">
          2nd Leg to be played
        </div>
      )}
    </div>
  );
}

// ── Single-leg match card (no aggregate) ─────────────────────────────────────
function SingleLegMatchCard({ match, roundName }: { match: Match; roundName: string }) {
  const isFT = match.status === "FT";
  const isLive = match.status === "LIVE" || match.status === "HT";
  const homeIsWinner = match.homeWinner || match.homeAdvance ||
    (isFT && match.homeScore > match.awayScore && !match.awayWinner && !match.awayAdvance);
  const awayIsWinner = match.awayWinner || match.awayAdvance ||
    (isFT && match.awayScore > match.homeScore && !match.homeWinner && !match.homeAdvance);
  const hasPenalties = isFT && (match.homePenaltyScore !== undefined || match.awayPenaltyScore !== undefined);

  return (
    <div className={`flex flex-col rounded-2xl overflow-hidden shadow-xl border transition-all duration-300 hover:scale-[1.01]
      ${isLive
        ? "bg-gradient-to-br from-rose-950/60 to-black border-rose-500/40 ring-1 ring-rose-500/20"
        : "bg-gradient-to-br from-slate-900/80 to-black border-slate-700/40"
      }
    `}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-white/[0.03] border-b border-white/[0.06] text-[10px] font-bold">
        <span className="text-gray-500 uppercase tracking-wider truncate">{roundName}</span>
        {isLive ? (
          <span className="flex items-center gap-1 text-rose-400">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />
            LIVE · {match.elapsedDisplay}
          </span>
        ) : isFT ? (
          <span className="text-gray-500 font-bold">FT</span>
        ) : (
          <span className="text-blue-400">{formatMatchDate(match.startTime)}</span>
        )}
      </div>

      {/* Home team row */}
      <div className={`flex items-center justify-between px-3 py-3 border-b border-white/[0.05]
        ${isFT && !homeIsWinner && awayIsWinner ? "opacity-30" : ""}
        ${isFT && homeIsWinner ? "bg-primary/5" : ""}
      `}>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <TeamLogo src={match.homeLogo} name={match.homeTeam} size={22} />
          <span className={`text-sm font-bold truncate ${homeIsWinner && isFT ? "text-primary" : "text-white"}`}>
            {match.homeTeam}
          </span>
          {homeIsWinner && isFT && <CheckCircle className="w-3.5 h-3.5 text-primary shrink-0" />}
        </div>
        <div className="flex items-baseline gap-1 shrink-0 ml-2">
          {match.status !== "SCHEDULED" ? (
            <>
              <span className={`text-base font-black tabular-nums ${homeIsWinner ? "text-primary" : "text-white"}`}>
                {match.homeScore}
              </span>
              {match.homePenaltyScore !== undefined && (
                <span className="text-[10px] font-bold text-gray-400">({match.homePenaltyScore})</span>
              )}
            </>
          ) : (
            <span className="text-sm text-gray-600 font-black">—</span>
          )}
        </div>
      </div>

      {/* Away team row */}
      <div className={`flex items-center justify-between px-3 py-3
        ${isFT && !awayIsWinner && homeIsWinner ? "opacity-30" : ""}
        ${isFT && awayIsWinner ? "bg-primary/5" : ""}
      `}>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <TeamLogo src={match.awayLogo} name={match.awayTeam} size={22} />
          <span className={`text-sm font-bold truncate ${awayIsWinner && isFT ? "text-primary" : "text-white"}`}>
            {match.awayTeam}
          </span>
          {awayIsWinner && isFT && <CheckCircle className="w-3.5 h-3.5 text-primary shrink-0" />}
        </div>
        <div className="flex items-baseline gap-1 shrink-0 ml-2">
          {match.status !== "SCHEDULED" ? (
            <>
              <span className={`text-base font-black tabular-nums ${awayIsWinner ? "text-primary" : "text-white"}`}>
                {match.awayScore}
              </span>
              {match.awayPenaltyScore !== undefined && (
                <span className="text-[10px] font-bold text-gray-400">({match.awayPenaltyScore})</span>
              )}
            </>
          ) : (
            <span className="text-sm text-gray-600 font-black">—</span>
          )}
        </div>
      </div>

      {hasPenalties && (
        <div className="px-3 py-1 text-center text-[10px] font-bold text-amber-400 bg-amber-500/5 border-t border-amber-500/10 tracking-wide">
          Decided on Penalties
        </div>
      )}
    </div>
  );
}

// ── KnockoutStageView — groups ties by round and renders them ─────────────────
function KnockoutStageView({ matches }: { matches: Match[] }) {
  // Group by roundName first
  const roundMap = new Map<string, Match[]>();
  const roundOrder = [
    "128", "64", "32", "16", "quarter", "semi", "final", "playoff", "elimination"
  ];
  const getRoundScore = (name: string) => {
    const l = name.toLowerCase();
    for (let i = 0; i < roundOrder.length; i++) {
      if (l.includes(roundOrder[i])) return i;
    }
    return 99;
  };

  for (const m of matches) {
    const round = m.roundName || "Knockout";
    if (!roundMap.has(round)) roundMap.set(round, []);
    roundMap.get(round)!.push(m);
  }

  const rounds = Array.from(roundMap.entries())
    .sort(([a], [b]) => getRoundScore(a) - getRoundScore(b));

  return (
    <div className="flex flex-col gap-6 mt-2 animate-fadeIn">
      {rounds.map(([roundName, roundMatches]) => {
        const ties = groupKnockoutByTie(roundMatches);
        return (
          <div key={roundName}>
            {/* Round header */}
            <div className="flex items-center gap-3 mb-3">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent to-white/10" />
              <span className="text-[10px] font-black uppercase tracking-[0.15em] text-gray-400 shrink-0 px-2">
                {roundName}
              </span>
              <div className="h-px flex-1 bg-gradient-to-l from-transparent to-white/10" />
            </div>

            {/* Tie cards grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {ties.map((tie) =>
                tie.isTwoLegged ? (
                  <TwoLeggedTieCard key={tie.tieId} tie={tie} />
                ) : (
                  <SingleLegMatchCard
                    key={tie.tieId}
                    match={tie.leg1!}
                    roundName={roundName}
                  />
                )
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Legacy VisualBracket kept for any future use ─────────────────────────────
// (No longer called from the standings tab; KnockoutStageView is used instead)

type BracketSlot = { teamName: string; teamLogo: string; confirmed: boolean };
type BracketNode = {
  match?: Match;
  roundName: string;
  topSlot: BracketSlot | null;
  bottomSlot: BracketSlot | null;
  children: BracketNode[];
};

function getMatchWinner(m: Match): { name: string; logo: string } | null {
  const homeIsWinner = m.homeWinner || m.homeAdvance || (m.homeScore > m.awayScore && !m.awayWinner && !m.awayAdvance);
  const awayIsWinner = m.awayWinner || m.awayAdvance || (m.awayScore > m.homeScore && !m.homeWinner && !m.homeAdvance);
  if (m.status === "FT" && homeIsWinner) return { name: m.homeTeam, logo: m.homeLogo };
  if (m.status === "FT" && awayIsWinner) return { name: m.awayTeam, logo: m.awayLogo };
  return null;
}

function deriveAdvancer(child: BracketNode): BracketSlot | null {
  if (!child.match) return null;
  const winner = getMatchWinner(child.match);
  if (winner) return { teamName: winner.name, teamLogo: winner.logo, confirmed: true };
  return null;
}

function buildBracketTree(matches: Match[]): BracketNode | null {
  // For two-legged ties, only use the decisive leg (leg 2, or leg 1 if leg 2 not available)
  const deduped: Match[] = [];
  const tiesSeen = new Set<string>();
  for (const m of [...matches].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())) {
    if (m.tieId) {
      if (tiesSeen.has(m.tieId) && m.legNumber !== 2) continue; // skip leg 1 if we already have leg 2
      if (!tiesSeen.has(m.tieId)) tiesSeen.add(m.tieId);
      if (m.legNumber === 2) deduped.push(m); else if (m.legNumber === 1) deduped.push(m);
    } else {
      deduped.push(m);
    }
  }

  const groups: Record<string, Match[]> = {};
  deduped.forEach(m => {
    const r = m.roundName || "Knockout";
    if (r.toLowerCase().includes("third") || r.toLowerCase().includes("3rd")) return;
    if (!groups[r]) groups[r] = [];
    groups[r].push(m);
  });

  const roundOrder = ["128", "64", "32", "16", "quarter", "semi", "final"];
  const getRoundScore = (name: string) => {
    const l = name.toLowerCase();
    for (let i = 0; i < roundOrder.length; i++) {
      if (l.includes(roundOrder[i])) return i;
    }
    return 99;
  };

  const rounds = Object.keys(groups).map(k => ({ name: k, matches: groups[k] }));
  rounds.sort((a, b) => getRoundScore(a.name) - getRoundScore(b.name));

  while (rounds.length > 0 && rounds[rounds.length - 1].matches.length > 1) {
    const lastLen = rounds[rounds.length - 1].matches.length;
    const nextLen = Math.ceil(lastLen / 2);
    rounds.push({ name: "Upcoming", matches: Array.from({ length: nextLen }).map(() => undefined as any) });
  }

  function buildNode(roundIdx: number, matchIdx: number): BracketNode {
    const r = rounds[roundIdx];
    const match: Match | undefined = r ? r.matches[matchIdx] : undefined;
    const roundName = r ? r.name : "TBD";
    const children: BracketNode[] = [];
    if (roundIdx > 0) {
      children.push(buildNode(roundIdx - 1, matchIdx * 2));
      children.push(buildNode(roundIdx - 1, matchIdx * 2 + 1));
    }
    let topSlot: BracketSlot | null = null;
    let bottomSlot: BracketSlot | null = null;
    if (match) {
      topSlot = { teamName: match.homeTeam, teamLogo: match.homeLogo, confirmed: true };
      bottomSlot = { teamName: match.awayTeam, teamLogo: match.awayLogo, confirmed: true };
    } else if (children.length >= 2) {
      topSlot = deriveAdvancer(children[0]);
      bottomSlot = deriveAdvancer(children[1]);
    }
    return { match, roundName, topSlot, bottomSlot, children };
  }

  if (rounds.length === 0) return null;
  return buildNode(rounds.length - 1, 0);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function VisualBracket({ matches }: { matches: Match[] }) {
  const rootNode = useMemo(() => buildBracketTree(matches), [matches]);
  if (!rootNode) return null;
  return (
    <div className="w-full overflow-x-auto custom-scrollbar pb-6 mt-4 animate-fadeIn">
      <div className="inline-block min-w-max">
        <div className="flex items-center justify-end bg-black/40 p-4 sm:p-8 rounded-3xl border border-white/5 shadow-inner backdrop-blur-md">
          <KnockoutStageView matches={matches} />
        </div>
      </div>
    </div>
  );
}





// ─── Standings Table ─────────────────────────────────────────────────────────


function StandingsTable({
  standings,
  compact = false,
}: {
  standings: CompetitionStandings;
  compact?: boolean;
}) {
  return (
    <div className="glass-card overflow-hidden">
      {standings.groupName && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 border-b border-primary/20">
          <Trophy className="w-3.5 h-3.5 text-primary shrink-0" />
          <span className="text-[11px] font-black text-primary uppercase tracking-widest">
            {standings.groupName}
          </span>
          {!compact && (
            <span className="text-[10px] text-gray-500 font-medium">· {standings.competition}</span>
          )}
        </div>
      )}
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-white/5 text-gray-400 text-[10px] uppercase tracking-wider font-bold">
              <th className="py-2 px-2.5 text-left w-8">#</th>
              <th className="py-2 px-2.5 text-left">Team</th>
              <th className="py-2 px-1 text-center w-7">P</th>
              <th className="py-2 px-1 text-center w-7">W</th>
              <th className="py-2 px-1 text-center w-7">D</th>
              <th className="py-2 px-1 text-center w-7">L</th>
              <th className="py-2 px-1 text-center w-8">GD</th>
              <th className="py-2 px-1 text-center w-8">Pts</th>
              {!compact && <th className="py-2 px-3 text-center">Form</th>}
            </tr>
          </thead>
          <tbody>
            {standings.table.map((team, i) => {
              const borderClass =
                team.position === 1
                  ? "border-l-2 border-l-yellow-500/70"
                  : team.position >= 2 && team.position <= 4
                  ? "border-l-2 border-l-primary/50"
                  : "border-l-2 border-l-transparent";

              return (
                <motion.tr
                  key={team.name}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: i * 0.03 }}
                  className={`border-b border-white/[0.03] hover:bg-white/[0.03] transition-colors ${borderClass} ${
                    i % 2 === 0 ? "bg-white/[0.01]" : ""
                  }`}
                >
                  <td className="py-2 px-2.5 text-gray-500 font-bold">
                    {team.position}
                  </td>
                  <td className="py-2 px-2.5">
                    <div className="flex items-center gap-2">
                      <TeamLogo src={team.logo} name={team.name} size={18} />
                      <span className="font-semibold text-white/90 truncate max-w-[90px] sm:max-w-[120px]">
                        {team.name}
                      </span>
                    </div>
                  </td>
                  <td className="py-2 px-1 text-center text-gray-400">
                    {team.played}
                  </td>
                  <td className="py-2 px-1 text-center text-gray-400">
                    {team.won}
                  </td>
                  <td className="py-2 px-1 text-center text-gray-400">
                    {team.drawn}
                  </td>
                  <td className="py-2 px-1 text-center text-gray-400">
                    {team.lost}
                  </td>
                  <td className="py-2 px-1 text-center text-gray-400 font-medium">
                    {team.goalDifference > 0
                      ? `+${team.goalDifference}`
                      : team.goalDifference}
                  </td>
                  <td className="py-2 px-1 text-center font-bold text-primary">
                    {team.points}
                  </td>
                  {!compact && (
                    <td className="py-2 px-3">
                      <div className="flex items-center justify-center gap-1">
                        {team.form.slice(-5).map((result, fi) => (
                          <span
                            key={fi}
                            className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white ${
                              result === "W"
                                ? "bg-green-500"
                                : result === "D"
                                ? "bg-yellow-500"
                                : "bg-rose-500"
                            }`}
                          >
                            {result}
                          </span>
                        ))}
                      </div>
                    </td>
                  )}
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
