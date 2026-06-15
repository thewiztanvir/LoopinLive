"use client";
/* eslint-disable @next/next/no-img-element */

import { motion, AnimatePresence } from "motion/react";
import { X } from "lucide-react";
import { useMemo } from "react";

interface MatchEvent {
  minute: number;
  type: "goal" | "card" | "sub";
  detail: string;
  team: "home" | "away";
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

interface SportsHudOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  matches: Match[];
  loading: boolean;
}

const statusOrder: Record<Match["status"], number> = {
  LIVE: 0,
  HT: 1,
  SCHEDULED: 2,
  FT: 3,
};

function StatusBadge({ status, elapsedDisplay, startTime }: {
  status: Match["status"];
  elapsedDisplay: string;
  startTime: string;
}) {
  if (status === "LIVE") {
    return (
      <span className="flex items-center gap-1 text-rose-400 font-black text-[10px]">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-rose-400" />
        </span>
        LIVE {elapsedDisplay}
      </span>
    );
  }

  if (status === "HT") {
    return (
      <span className="text-amber-400 font-black text-[10px]">HT</span>
    );
  }

  if (status === "FT") {
    return (
      <span className="text-gray-500 font-black text-[10px]">FT</span>
    );
  }

  // SCHEDULED
  const time = new Date(startTime).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <span className="text-gray-400 font-bold text-[10px]">{time}</span>
  );
}

function MatchCard({ match, index }: { match: Match; index: number }) {
  const recentGoals = match.events
    .filter((e) => e.type === "goal")
    .slice(-2);

  const isLive = match.status === "LIVE";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className={`bg-white/[0.03] border border-white/[0.05] rounded-xl p-2.5 mb-2 ${
        isLive ? "border-l-2 border-l-rose-500" : ""
      }`}
    >
      {/* Competition & Status */}
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[9px] uppercase tracking-wider text-gray-500 font-bold truncate max-w-[60%]">
          {match.competition}
        </span>
        <StatusBadge
          status={match.status}
          elapsedDisplay={match.elapsedDisplay}
          startTime={match.startTime}
        />
      </div>

      {/* Teams & Score */}
      <div className="flex items-center justify-between gap-1">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <img
            src={match.homeLogo}
            alt={match.homeTeam}
            className="w-4 h-4 object-contain shrink-0"
          />
          <span className="text-xs font-bold text-white truncate">
            {match.homeTeam}
          </span>
        </div>

        <div className="shrink-0 px-1.5">
          {match.status === "SCHEDULED" ? (
            <span className="text-[10px] text-gray-500 font-medium">vs</span>
          ) : (
            <span className="text-sm font-black text-white">
              {match.homeScore} - {match.awayScore}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
          <span className="text-xs font-bold text-white truncate text-right">
            {match.awayTeam}
          </span>
          <img
            src={match.awayLogo}
            alt={match.awayTeam}
            className="w-4 h-4 object-contain shrink-0"
          />
        </div>
      </div>

      {/* Recent Goals */}
      {recentGoals.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
          {recentGoals.map((event, i) => (
            <span key={i} className="text-[9px] text-gray-400">
              ⚽ {event.minute}&apos; {event.detail}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-white/[0.03] border border-white/[0.05] rounded-xl p-2.5 mb-2 animate-pulse">
      <div className="flex items-center justify-between mb-1.5">
        <div className="h-2 w-16 bg-white/10 rounded" />
        <div className="h-2 w-10 bg-white/10 rounded" />
      </div>
      <div className="flex items-center justify-between gap-1">
        <div className="flex items-center gap-1.5 flex-1">
          <div className="w-4 h-4 bg-white/10 rounded-full shrink-0" />
          <div className="h-3 w-16 bg-white/10 rounded" />
        </div>
        <div className="h-4 w-10 bg-white/10 rounded shrink-0" />
        <div className="flex items-center gap-1.5 flex-1 justify-end">
          <div className="h-3 w-16 bg-white/10 rounded" />
          <div className="w-4 h-4 bg-white/10 rounded-full shrink-0" />
        </div>
      </div>
      <div className="mt-1.5 flex gap-3">
        <div className="h-2 w-20 bg-white/10 rounded" />
        <div className="h-2 w-20 bg-white/10 rounded" />
      </div>
    </div>
  );
}

export default function SportsHudOverlay({
  isOpen,
  onClose,
  matches,
  loading,
}: SportsHudOverlayProps) {
  const sortedMatches = useMemo(() => {
    const liveCount = matches.filter(
      (m) => m.status === "LIVE" || m.status === "HT"
    ).length;

    const filtered =
      liveCount > 2
        ? matches.filter((m) => m.status !== "FT")
        : matches;

    return [...filtered].sort(
      (a, b) => statusOrder[a.status] - statusOrder[b.status]
    );
  }, [matches]);

  const isEmpty = !loading && matches.length === 0;
  const showSkeleton = loading && matches.length === 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: "100%", opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: "100%", opacity: 0 }}
          transition={{ type: "spring", duration: 0.4, bounce: 0.1 }}
          className="absolute top-0 right-0 bottom-0 z-30 w-[280px] sm:w-[320px] bg-[#070414]/90 backdrop-blur-2xl border-l border-white/10 rounded-l-2xl flex flex-col"
        >
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between px-3 py-2.5 border-b border-white/[0.06]">
            <h2 className="text-sm font-bold text-white">⚽ Live Scores</h2>
            <button
              onClick={onClose}
              className="rounded-full bg-white/10 hover:bg-white/20 p-1.5 text-white transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Match List */}
          <div className="flex-1 overflow-y-auto custom-scrollbar px-2.5 py-2">
            {showSkeleton && (
              <>
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </>
            )}

            {isEmpty && (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-500">
                <span className="text-2xl">⚽</span>
                <span className="text-xs text-center">
                  No live matches right now
                </span>
              </div>
            )}

            {!showSkeleton &&
              sortedMatches.map((match, i) => (
                <MatchCard key={match.id} match={match} index={i} />
              ))}
          </div>

          {/* Footer */}
          <div className="px-3 py-2 text-center border-t border-white/[0.04]">
            <span className="text-[9px] text-gray-600">
              Press S to toggle
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
