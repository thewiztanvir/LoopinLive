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

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatStartTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMatchDate(iso: string): string {
  if (!iso) return "";
  const match = new Date(iso);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowStart = new Date(todayStart.getTime() + 86_400_000);
  const dayAfterStart = new Date(todayStart.getTime() + 2 * 86_400_000);
  const time = match.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (match >= todayStart && match < tomorrowStart) return `Today · ${time}`;
  if (match >= tomorrowStart && match < dayAfterStart) return `Tomorrow · ${time}`;
  const dayName = match.toLocaleDateString([], { weekday: "short" });
  const day = match.getDate();
  const month = match.toLocaleDateString([], { month: "short" });
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

// ─── Main Component ──────────────────────────────────────────────────────────

export default function SportsHub({
  matches,
  standings,
  loading,
  lastUpdated,
  onTuneToChannel,
}: SportsHubProps) {
  const [activeTab, setActiveTab] = useState<"matches" | "standings">("matches");
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [leagueFilter, setLeagueFilter] = useState("All");
  const [standingsLeague, setStandingsLeague] = useState("");
  const standingsKey = (s: CompetitionStandings) => `${s.competition}${s.groupName ?? ""}`;

  // Set default standings league when data arrives
  useEffect(() => {
    if (standings.length > 0 && !standingsLeague) {
      setStandingsLeague(standingsKey(standings[0]));
    }
  }, [standings, standingsLeague]);

  // Keep selected match details synced with parent polling updates
  useEffect(() => {
    if (selectedMatch) {
      const updated = matches.find((m) => m.id === selectedMatch.id);
      if (updated) {
        setSelectedMatch(updated);
      }
    }
  }, [matches, selectedMatch]);

  // Close detail panel on Escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedMatch) {
        setSelectedMatch(null);
      }
    },
    [selectedMatch]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Derived data
  const competitions = useMemo(() => {
    const set = new Set(matches.map((m) => m.competition));
    return ["All", ...Array.from(set)];
  }, [matches]);

  const filteredMatches = useMemo(() => {
    if (leagueFilter === "All") return matches;
    return matches.filter((m) => m.competition === leagueFilter);
  }, [matches, leagueFilter]);

  const liveMatches = useMemo(
    () => filteredMatches.filter((m) => m.status === "LIVE" || m.status === "HT"),
    [filteredMatches]
  );
  const scheduledMatches = useMemo(
    () => filteredMatches.filter((m) => m.status === "SCHEDULED"),
    [filteredMatches]
  );
  const completedMatches = useMemo(
    () => filteredMatches.filter((m) => m.status === "FT"),
    [filteredMatches]
  );

  const selectedStandings = useMemo(
    () => standings.find((s) => standingsKey(s) === standingsLeague),
    [standings, standingsLeague]
  );

  // ─── Render ────────────────────────────────────────────────────────────────

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

      {/* Tab Pills */}
      <div className="flex gap-1 p-1 rounded-xl bg-white/5 w-fit">
        {(["matches", "standings"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2 rounded-lg text-sm font-semibold capitalize transition-all duration-200 ${
              activeTab === tab
                ? "bg-primary text-white shadow-lg shadow-primary/20"
                : "text-gray-400 hover:text-white hover:bg-white/5"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === "matches" ? (
          <motion.div
            key="matches"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="flex flex-col gap-4"
          >
            {/* League Filter Bar */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              {competitions.map((comp) => (
                <button
                  key={comp}
                  onClick={() => {
                    setLeagueFilter(comp);
                    setSelectedMatch(null);
                  }}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-all duration-200 shrink-0 ${
                    leagueFilter === comp
                      ? "bg-primary text-white shadow-lg shadow-primary/20 border-primary"
                      : "bg-white/5 border-white/5 text-gray-400 hover:text-white hover:bg-white/10"
                  }`}
                >
                  {comp}
                </button>
              ))}
            </div>

            {/* Loading State */}
            {loading && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            )}

            {/* Empty State */}
            {!loading && matches.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-gray-500 gap-3">
                <SoccerBallIcon className="w-10 h-10 text-gray-600 shrink-0" />
                <p className="text-sm font-medium">No matches available</p>
              </div>
            )}

            {/* Match Sections — always visible; skeletons shown only on initial load */}
            {matches.length > 0 && (
              <div className="flex flex-col gap-5">
                {/* LIVE NOW */}
                {liveMatches.length > 0 && (
                  <MatchSection
                    title="LIVE NOW"
                    icon={
                      <span className="relative flex h-2.5 w-2.5 mr-1">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500" />
                      </span>
                    }
                    titleClass="text-rose-400"
                    matches={liveMatches}
                    selectedMatch={selectedMatch}
                    onSelect={setSelectedMatch}
                    onTuneToChannel={onTuneToChannel}
                  />
                )}

                {/* UPCOMING */}
                {scheduledMatches.length > 0 && (
                  <MatchSection
                    title="UPCOMING"
                    icon={<Clock className="w-3.5 h-3.5 text-blue-400" />}
                    titleClass="text-blue-400"
                    matches={scheduledMatches}
                    selectedMatch={selectedMatch}
                    onSelect={setSelectedMatch}
                    onTuneToChannel={onTuneToChannel}
                  />
                )}

                {/* COMPLETED */}
                {completedMatches.length > 0 && (
                  <MatchSection
                    title="COMPLETED"
                    icon={<CheckCircle className="w-3.5 h-3.5 text-gray-500" />}
                    titleClass="text-gray-500"
                    matches={completedMatches}
                    selectedMatch={selectedMatch}
                    onSelect={setSelectedMatch}
                    onTuneToChannel={onTuneToChannel}
                  />
                )}
              </div>
            )}

            {/* Match Detail Panel */}
            <AnimatePresence>
              {selectedMatch && (
                <MatchDetailPanel
                  match={selectedMatch}
                  onClose={() => setSelectedMatch(null)}
                />
              )}
            </AnimatePresence>
          </motion.div>
        ) : (
          <motion.div
            key="standings"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="flex flex-col gap-4"
          >
            {/* League Selector */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              {standings.map((s) => {
                const label = s.groupName
                  ? `${s.competition.split(" ")[0]} ${s.groupName}`
                  : s.competition;
                const key = `${s.competition}${s.groupName ?? ""}`;
                return (
                  <button
                    key={key}
                    onClick={() => setStandingsLeague(key)}
                    className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-all duration-200 shrink-0 ${
                      standingsLeague === key
                        ? "bg-primary text-white shadow-lg shadow-primary/20 border-primary"
                        : "bg-white/5 border-white/5 text-gray-400 hover:text-white hover:bg-white/10"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Standings Table */}
            {selectedStandings && (
              <StandingsTable standings={selectedStandings} />
            )}
          </motion.div>
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
}: {
  title: string;
  icon: React.ReactNode;
  titleClass: string;
  matches: Match[];
  selectedMatch: Match | null;
  onSelect: (m: Match) => void;
  onTuneToChannel?: (name: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2.5">
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {matches.map((match, i) => (
          <motion.div
            key={match.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.05 }}
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

      {/* ── Main Scorecard Body (Horizontal TV layout) ── */}
      <div className="px-5 py-5 flex items-center justify-between gap-4">
        {/* Home Team */}
        <div className="flex-1 flex flex-col items-end min-w-0">
          <div className="flex items-center justify-end gap-3 w-full min-w-0">
            <span className={`text-sm md:text-base font-extrabold text-white text-right truncate ${isFT && match.homeScore < match.awayScore ? "opacity-50" : ""}`}>
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
                {new Date(match.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-3 bg-black/40 px-4 py-2 rounded-xl border border-white/5 shadow-inner">
              <ScoreDisplay
                value={match.homeScore}
                winning={match.homeScore > match.awayScore}
                className="text-3xl font-black"
              />
              <span className="text-white/20 font-bold text-lg select-none">:</span>
              <ScoreDisplay
                value={match.awayScore}
                winning={match.awayScore > match.homeScore}
                className="text-3xl font-black"
              />
            </div>
          )}
        </div>

        {/* Away Team */}
        <div className="flex-1 flex flex-col items-start min-w-0">
          <div className="flex items-center justify-start gap-3 w-full min-w-0">
            <TeamLogo src={match.awayLogo} name={match.awayTeam} size={32} />
            <span className={`text-sm md:text-base font-extrabold text-white text-left truncate ${isFT && match.awayScore < match.homeScore ? "opacity-50" : ""}`}>
              {match.awayTeam}
            </span>
          </div>
          {awayGoals.length > 0 && renderScorersList(awayGoals, "left")}
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

  useEffect(() => {
    fetchDetails();

    // Poll every 15 seconds for live matches
    const isLive = match.status === "LIVE" || match.status === "HT";
    let interval: NodeJS.Timeout;
    if (isLive) {
      interval = setInterval(() => {
        fetchDetails(true);
      }, 15000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [fetchDetails, match.status]);

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
    <div
      className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 md:p-6 overflow-y-auto"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="relative bg-gradient-to-b from-slate-900/95 via-black/95 to-black border border-white/10 rounded-3xl w-full max-w-2xl shadow-2xl flex flex-col p-6 overflow-hidden max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between mb-4 shrink-0">
          <div className="flex items-center gap-3">
            <Trophy className="w-4 h-4 text-primary" />
            <span className="text-xs font-extrabold text-white uppercase tracking-wider">
              {match.competition}
            </span>
            {getModalStatusBadge()}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer border-none bg-transparent outline-none"
            aria-label="Close details"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

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
                    {new Date(match.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ) : (
                <>
                  <span className="text-3xl sm:text-4xl font-black text-white tabular-nums">
                    {detailData?.homeScore ?? match.homeScore}
                  </span>
                  <span className="text-xl text-gray-600 font-bold select-none">-</span>
                  <span className="text-3xl sm:text-4xl font-black text-white tabular-nums">
                    {detailData?.awayScore ?? match.awayScore}
                  </span>
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
        <div className="flex gap-1 p-1 rounded-xl bg-white/5 mb-4 shrink-0">
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

        {/* Tab Contents Container */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-6 custom-scrollbar min-h-[30vh]">
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 text-gray-500 gap-3">
              <RefreshCw className="w-8 h-8 animate-spin text-primary" />
              <p className="text-xs font-semibold">Loading live match details...</p>
            </div>
          )}

          {error && !detailData && (
            <div className="flex flex-col items-center justify-center py-16 text-rose-400 text-center px-4 gap-2">
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

          {/* Details render if detailsData is ready */}
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
          <div className="border-t border-white/5 pt-3.5 mt-4 text-[10px] text-gray-500 flex flex-wrap gap-4 justify-between items-center shrink-0">
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
      </motion.div>
    </div>
  );
}

// ─── Standings Table ─────────────────────────────────────────────────────────

function StandingsTable({
  standings,
}: {
  standings: CompetitionStandings;
}) {
  return (
    <div className="glass-card overflow-hidden">
      {standings.groupName && (
        <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 border-b border-primary/20">
          <Trophy className="w-3.5 h-3.5 text-primary shrink-0" />
          <span className="text-[11px] font-black text-primary uppercase tracking-widest">
            {standings.groupName}
          </span>
          <span className="text-[10px] text-gray-500 font-medium">· {standings.competition}</span>
        </div>
      )}
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-white/5 text-gray-400 text-[10px] uppercase tracking-wider font-bold">
              <th className="py-2.5 px-3 text-left w-8">#</th>
              <th className="py-2.5 px-3 text-left">Team</th>
              <th className="py-2.5 px-2 text-center w-8">P</th>
              <th className="py-2.5 px-2 text-center w-8">W</th>
              <th className="py-2.5 px-2 text-center w-8">D</th>
              <th className="py-2.5 px-2 text-center w-8">L</th>
              <th className="py-2.5 px-2 text-center w-10">GD</th>
              <th className="py-2.5 px-2 text-center w-10">Pts</th>
              <th className="py-2.5 px-3 text-center">Form</th>
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
                  <td className="py-2.5 px-3 text-gray-500 font-bold">
                    {team.position}
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2">
                      <TeamLogo src={team.logo} name={team.name} size={20} />
                      <span className="font-semibold text-white/90 truncate max-w-[140px]">
                        {team.name}
                      </span>
                    </div>
                  </td>
                  <td className="py-2.5 px-2 text-center text-gray-400">
                    {team.played}
                  </td>
                  <td className="py-2.5 px-2 text-center text-gray-400">
                    {team.won}
                  </td>
                  <td className="py-2.5 px-2 text-center text-gray-400">
                    {team.drawn}
                  </td>
                  <td className="py-2.5 px-2 text-center text-gray-400">
                    {team.lost}
                  </td>
                  <td className="py-2.5 px-2 text-center text-gray-400 font-medium">
                    {team.goalDifference > 0
                      ? `+${team.goalDifference}`
                      : team.goalDifference}
                  </td>
                  <td className="py-2.5 px-2 text-center font-bold text-primary">
                    {team.points}
                  </td>
                  <td className="py-2.5 px-3">
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
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
