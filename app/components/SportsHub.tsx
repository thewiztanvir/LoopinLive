"use client";
/* eslint-disable @next/next/no-img-element */

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Trophy,
  Clock,
  CheckCircle,
  X,
  Play,
  RefreshCw,
  ChevronRight,
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

function eventIcon(type: MatchEvent["type"]): string {
  switch (type) {
    case "goal":
      return "⚽";
    case "card":
      return "🟨";
    case "sub":
      return "🔄";
  }
}

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
    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 animate-pulse">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-5 h-5 rounded-full bg-white/10" />
        <div className="h-3 w-28 rounded bg-white/10" />
      </div>
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-white/10" />
          <div className="h-4 w-24 rounded bg-white/10" />
          <div className="ml-auto h-6 w-6 rounded bg-white/10" />
        </div>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-white/10" />
          <div className="h-4 w-20 rounded bg-white/10" />
          <div className="ml-auto h-6 w-6 rounded bg-white/10" />
        </div>
      </div>
      <div className="mt-4 flex justify-center">
        <div className="h-5 w-12 rounded-full bg-white/10" />
      </div>
    </div>
  );
}

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

  // Set default standings league when data arrives
  useEffect(() => {
    if (standings.length > 0 && !standingsLeague) {
      setStandingsLeague(standings[0].competition);
    }
  }, [standings, standingsLeague]);

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
    () => standings.find((s) => s.competition === standingsLeague),
    [standings, standingsLeague]
  );

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="w-full flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl" role="img" aria-label="football">
            ⚽
          </span>
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
              <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                <span className="text-4xl mb-3">⚽</span>
                <p className="text-sm font-medium">No matches available</p>
              </div>
            )}

            {/* Match Sections */}
            {!loading && matches.length > 0 && (
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
              {standings.map((s) => (
                <button
                  key={s.competition}
                  onClick={() => setStandingsLeague(s.competition)}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-all duration-200 shrink-0 ${
                    standingsLeague === s.competition
                      ? "bg-primary text-white shadow-lg shadow-primary/20 border-primary"
                      : "bg-white/5 border-white/5 text-gray-400 hover:text-white hover:bg-white/10"
                  }`}
                >
                  {s.competition}
                </button>
              ))}
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

  return (
    <button
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter") onSelect();
      }}
      className={`w-full text-left bg-white/[0.02] border border-white/5 rounded-2xl p-4 transition-all duration-200
        hover:bg-white/[0.05] hover:border-white/10
        focus:outline-none focus:ring-2 focus:ring-primary/50 focus:shadow-[0_0_15px_rgba(27,226,27,0.3)]
        ${isLive ? "border-l-4 border-l-rose-500" : ""}
        ${isSelected ? "ring-2 ring-primary/40 bg-white/[0.04]" : ""}`}
    >
      {/* Competition Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          {match.competitionLogo && (
            <img
              src={match.competitionLogo}
              alt=""
              className="w-4 h-4 rounded-sm object-contain shrink-0"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          )}
          <span className="text-[11px] text-gray-400 font-medium truncate">
            {match.competition}
          </span>
        </div>
        <StatusBadge status={match.status} elapsed={match.elapsedDisplay} />
      </div>

      {/* Teams & Score */}
      <div className="flex flex-col gap-2">
        {/* Home */}
        <div className="flex items-center gap-3">
          <TeamLogo src={match.homeLogo} name={match.homeTeam} />
          <span className="text-sm font-semibold text-white/90 flex-1 truncate">
            {match.homeTeam}
          </span>
          {match.status !== "SCHEDULED" ? (
            <span className="text-2xl font-black text-white tabular-nums min-w-[28px] text-right">
              {match.homeScore}
            </span>
          ) : null}
        </div>

        {/* Divider */}
        <div className="flex items-center gap-2 px-1">
          <div className="flex-1 h-px bg-white/[0.04]" />
          <span className="text-[10px] text-gray-600 font-medium uppercase">
            vs
          </span>
          <div className="flex-1 h-px bg-white/[0.04]" />
        </div>

        {/* Away */}
        <div className="flex items-center gap-3">
          <TeamLogo src={match.awayLogo} name={match.awayTeam} />
          <span className="text-sm font-semibold text-white/90 flex-1 truncate">
            {match.awayTeam}
          </span>
          {match.status !== "SCHEDULED" ? (
            <span className="text-2xl font-black text-white tabular-nums min-w-[28px] text-right">
              {match.awayScore}
            </span>
          ) : null}
        </div>
      </div>

      {/* Bottom row: Start time for scheduled, or broadcaster button */}
      <div className="mt-3 flex items-center justify-between">
        {match.status === "SCHEDULED" && (
          <span className="text-xs text-gray-500 flex items-center gap-1.5">
            <Clock className="w-3 h-3" />
            {formatStartTime(match.startTime)}
          </span>
        )}

        {isLive && match.broadcasterRecommendation && onTuneToChannel && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onTuneToChannel(match.broadcasterRecommendation!);
            }}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white
              bg-gradient-to-r from-primary to-[#7df36b] hover:from-[#048d1f] hover:to-[#4efc04]
              shadow-lg shadow-primary/20 transition-all duration-200"
          >
            <Play className="w-3 h-3" fill="currentColor" />
            Watch on {match.broadcasterRecommendation}
          </button>
        )}

        {match.status !== "SCHEDULED" && (
          <span className="ml-auto flex items-center gap-1 text-[11px] text-gray-500 group-hover:text-gray-400">
            Details
            <ChevronRight className="w-3 h-3" />
          </span>
        )}
      </div>
    </button>
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
  const awayPossession = 100 - match.stats.possession;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, height: 0 }}
      animate={{ opacity: 1, y: 0, height: "auto" }}
      exit={{ opacity: 0, y: 20, height: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="glass-card p-5 overflow-hidden"
    >
      {/* Panel Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <Trophy className="w-4 h-4 text-primary" />
          <span className="text-sm font-bold text-white">
            {match.homeTeam} vs {match.awayTeam}
          </span>
          <StatusBadge status={match.status} elapsed={match.elapsedDisplay} />
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          aria-label="Close details"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Score Banner */}
      <div className="flex items-center justify-center gap-6 mb-6">
        <div className="flex flex-col items-center gap-2">
          <TeamLogo src={match.homeLogo} name={match.homeTeam} size={40} />
          <span className="text-xs font-medium text-gray-400 max-w-[80px] text-center truncate">
            {match.homeTeam}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-4xl font-black text-white tabular-nums">
            {match.homeScore}
          </span>
          <span className="text-lg text-gray-600 font-medium">-</span>
          <span className="text-4xl font-black text-white tabular-nums">
            {match.awayScore}
          </span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <TeamLogo src={match.awayLogo} name={match.awayTeam} size={40} />
          <span className="text-xs font-medium text-gray-400 max-w-[80px] text-center truncate">
            {match.awayTeam}
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-6">
        <h4 className="text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-3">
          Match Stats
        </h4>
        <div className="space-y-3">
          <StatBar
            label="Possession"
            homeVal={match.stats.possession}
            awayVal={awayPossession}
            isPercentage
          />
          <StatBar
            label="Shots on Target"
            homeVal={match.stats.shotsOnTarget}
            awayVal={match.stats.shotsOnTarget}
          />
          <StatBar
            label="Corners"
            homeVal={match.stats.corners}
            awayVal={match.stats.corners}
          />
          <StatBar
            label="Fouls"
            homeVal={match.stats.fouls}
            awayVal={match.stats.fouls}
          />
        </div>
      </div>

      {/* Events Timeline */}
      <div>
        <h4 className="text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-3">
          Match Events
        </h4>
        {match.events.length === 0 ? (
          <div className="text-center py-6 text-gray-600 text-xs">
            No events recorded yet
          </div>
        ) : (
          <div className="relative space-y-2">
            {/* Central timeline line */}
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/[0.06] -translate-x-1/2" />

            {match.events.map((event, i) => (
              <motion.div
                key={`${event.minute}-${event.type}-${i}`}
                initial={{ opacity: 0, x: event.team === "home" ? -20 : 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: i * 0.08 }}
                className={`flex items-center gap-2 ${
                  event.team === "home"
                    ? "flex-row pr-[52%]"
                    : "flex-row-reverse pl-[52%]"
                }`}
              >
                <div
                  className={`flex items-center gap-2 flex-1 ${
                    event.team === "away" ? "flex-row-reverse text-right" : ""
                  }`}
                >
                  <span className="text-xs text-gray-400 bg-white/5 rounded-full px-2 py-0.5 font-mono font-bold shrink-0">
                    {event.minute}&apos;
                  </span>
                  <span className="text-sm shrink-0">{eventIcon(event.type)}</span>
                  <span className="text-xs text-gray-300 truncate">
                    {event.detail}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
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
