"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Hls from "hls.js";
import { motion, AnimatePresence } from "motion/react";
import {
  Tv,
  Play,
  Pause,
  Link,
  Check,
  Radio,
  Trash2,
  Upload,
  Search,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  RotateCw,
  RefreshCw,
  FileText,
  AlertCircle,
  ShieldAlert,
  PictureInPicture,
  ChevronsLeft,
  ChevronsRight,
  Trophy
} from "lucide-react";
import { FaGithub, FaYoutube, FaLinkedin, FaGlobe } from "react-icons/fa6";
import SportsHub from "./SportsHub";
import SportsHudOverlay from "./SportsHudOverlay";

interface Channel {
  id: string;
  name: string;
  logo: string;
  group: string;
  url: string;
  kid?: string;
  key?: string;
}

interface Playlist {
  id: string;
  name: string;
  type: "default" | "upload" | "url";
  url?: string;
  channels: Channel[];
}

interface ChannelsResponse {
  channels: Channel[];
  total: number;
  totalAvailable: number;
  offset: number;
  limit: number;
  hasMore: boolean;
  nextOffset: number;
  categories: string[];
}

const CHANNEL_PAGE_SIZE = 80;
const VIRTUAL_ROW_HEIGHT = 68;
const VIRTUAL_GAP = 12;
const VIRTUAL_OVERSCAN_CHANNELS = 20;
const CHANNEL_PREFETCH_DISTANCE = 1200;

const POPULAR_CATEGORY_ORDER = [
  "All",
  "Sports",
  "News",
  "Movies",
  "Movie",
  "Kids",
  "Entertainment",
  "Music",
  "Documentary",
  "Documentaries (EN)",
  "Education",
  "Religious",
  "Lifestyle",
  "Cooking",
  "Travel",
  "Business",
  "Weather",
];

const COUNTRY_CATEGORY_ORDER = [
  "Bangla",
  "Bangladesh",
  "English",
  "Hindi",
  "Indian Bangla",
  "India",
  "Pakistan",
  "USA",
  "UK",
  "Canada",
  "France",
  "Germany",
  "Italy",
  "Spain",
  "Turkey",
  "Qatar",
  "Saudi Arabia",
  "United Arab Emirates",
];

const REGION_CATEGORY_KEYWORDS = ["capital", "region", "north", "south", "east", "west"];

function getCategoryRank(category: string) {
  const popularIndex = POPULAR_CATEGORY_ORDER.indexOf(category);
  if (popularIndex !== -1) return popularIndex;

  const countryIndex = COUNTRY_CATEGORY_ORDER.indexOf(category);
  if (countryIndex !== -1) {
    return 100 + countryIndex;
  }

  const lowerCategory = category.toLowerCase();
  if (REGION_CATEGORY_KEYWORDS.some((keyword) => lowerCategory.includes(keyword))) {
    return 200;
  }

  if (category.includes(";")) {
    return 400;
  }

  return 300;
}

function sortCategoriesByUsefulness(categories: string[]) {
  return [...categories].sort((a, b) => {
    const rankDiff = getCategoryRank(a) - getCategoryRank(b);
    if (rankDiff !== 0) return rankDiff;

    return a.localeCompare(b);
  });
}

function getStreamFormat(url: string): "hls" | "dash" | "unknown" {
  const cleanUrl = url.split("?")[0].toLowerCase();
  if (cleanUrl.endsWith(".m3u8") || cleanUrl.includes(".m3u8")) return "hls";
  if (cleanUrl.endsWith(".mpd") || cleanUrl.includes(".mpd")) return "dash";
  return "unknown";
}

function isSafariBrowser(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent.toLowerCase();
  return ua.includes("safari") && !ua.includes("chrome") && !ua.includes("android");
}

export default function LoopinLiveStream() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [channelTotal, setChannelTotal] = useState(0);
  const [hasMoreChannels, setHasMoreChannels] = useState(false);
  const [nextChannelOffset, setNextChannelOffset] = useState(0);
  const [defaultCategories, setDefaultCategories] = useState<string[]>(["All"]);
  const [fifaChannels, setFifaChannels] = useState<Channel[]>([]);
  const [fifaLoading, setFifaLoading] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [submittedSearchQuery, setSubmittedSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  // Playlist Management States
  const [playlists, setPlaylists] = useState<Playlist[]>([
    { id: "default", name: "Default TV", type: "default", channels: [] },
  ]);
  const [activePlaylistId, setActivePlaylistId] = useState<string>("default");

  // Custom playlist loading states
  const [playlistTab, setPlaylistTab] = useState<"browse" | "sports" | "manage">("browse");
  const [importUrl, setImportUrl] = useState("");
  const [playlistName, setPlaylistName] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Football Data Integration States
  const [footballMatches, setFootballMatches] = useState<any[]>([]);
  const [footballStandings, setFootballStandings] = useState<any[]>([]);
  const [footballLoading, setFootballLoading] = useState<boolean>(false);
  // Tracks the very first fetch — skeletons only show during this phase
  const [footballInitialLoading, setFootballInitialLoading] = useState<boolean>(true);
  const footballHasLoadedRef = useRef(false);
  const [footballLastUpdated, setFootballLastUpdated] = useState<Date | null>(null);
  const [isSportsHudOpen, setIsSportsHudOpen] = useState<boolean>(false);

  const [playerStatus, setPlayerStatus] = useState<
    "idle" | "playing" | "loading" | "error"
  >("idle");
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [lastSuccessfulChannel, setLastSuccessfulChannel] = useState<Channel | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const playerWrapperRef = useRef<HTMLDivElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const channelListRef = useRef<HTMLDivElement>(null);
  const channelsRef = useRef<Channel[]>([]);
  const defaultFetchIdRef = useRef(0);
  const [retryKey, setRetryKey] = useState(0);
  const [listScrollTop, setListScrollTop] = useState(0);
  const [listHeight, setListHeight] = useState(0);
  const [gridColumns, setGridColumns] = useState(1);

  // Custom Player controls states
  const [isPaused, setIsPaused] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [volume, setVolume] = useState(0.8);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const isFullscreenRef = useRef(false);
  const [isPip, setIsPip] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isRotated, setIsRotated] = useState(false);
  const [focusedChannelId, setFocusedChannelId] = useState<string | null>(null);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmuteCleanupRef = useRef<(() => void) | null>(null);
  const filteredChannelsRef = useRef<Channel[]>([]);
  const selectedChannelRef = useRef<Channel | null>(null);
  const focusedChannelIdRef = useRef<string | null>(null);

  const hlsRef = useRef<Hls | null>(null);
  const shakaPlayerRef = useRef<any>(null);
  const userMutedRef = useRef(false);
  const isMutedRef = useRef(isMuted);
  const volumeRef = useRef(volume);
  const loadedUrlRef = useRef<string | null>(null);

  useEffect(() => {
    isMutedRef.current = isMuted;
    // Sync muted state imperatively instead of via React prop to avoid video re-renders
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
    }
  }, [isMuted]);

  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);

  // Synchronize player success state
  useEffect(() => {
    if (playerStatus === "playing" && selectedChannel) {
      setPlayerError(null);
      setLastSuccessfulChannel(selectedChannel);
    }
  }, [playerStatus, selectedChannel]);

  // Football/Sports API fetching
  const fetchFootballData = useCallback(async () => {
    setFootballLoading(true);
    try {
      const response = await fetch("/api/football");
      if (response.ok) {
        const data = await response.json();
        setFootballMatches(data.matches || []);
        setFootballStandings(data.standings || []);
        setFootballLastUpdated(new Date());
        // Mark initial load complete on first successful fetch
        if (!footballHasLoadedRef.current) {
          footballHasLoadedRef.current = true;
          setFootballInitialLoading(false);
        }
      }
    } catch (err) {
      console.error("Error fetching football data:", err);
      // If first fetch fails, still clear the skeleton so we can show empty state
      if (!footballHasLoadedRef.current) {
        footballHasLoadedRef.current = true;
        setFootballInitialLoading(false);
      }
    } finally {
      setFootballLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFootballData();
    // Adaptive poll: 15s when live matches exist, 30s otherwise
    const hasLive = footballMatches.some(
      (m: { status: string }) => m.status === "LIVE" || m.status === "HT"
    );
    const interval = setInterval(fetchFootballData, hasLive ? 15_000 : 30_000);
    return () => clearInterval(interval);
  }, [fetchFootballData, footballMatches]);

  // YouTube-like Double Tap Seek State
  const [activeSeekIndicator, setActiveSeekIndicator] = useState<{
    side: "left" | "right";
    visible: boolean;
  }>({ side: "left", visible: false });
  const seekIndicatorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const clickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetControlsTimeout = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      const video = videoRef.current;
      if (video && !video.paused) {
        setShowControls(false);
      }
    }, 3000);
  }, []);

  const setupUnmuteOnInteraction = useCallback(() => {
    if (unmuteCleanupRef.current) {
      unmuteCleanupRef.current();
    }

    const unmute = () => {
      const v = videoRef.current;
      if (v && v.muted) {
        v.muted = false;
        setIsMuted(false);
        if (v.volume === 0) {
          v.volume = 1.0;
          setVolume(1.0);
        }
      }
      cleanup();
    };

    const cleanup = () => {
      document.removeEventListener("click", unmute);
      document.removeEventListener("touchstart", unmute);
      document.removeEventListener("keydown", unmute);
      unmuteCleanupRef.current = null;
    };

    document.addEventListener("click", unmute);
    document.addEventListener("touchstart", unmute);
    document.addEventListener("keydown", unmute);
    unmuteCleanupRef.current = cleanup;
  }, []);

  // Auto-hide controls after 3s if video is playing
  useEffect(() => {
    const timeout = setTimeout(() => {
      const video = videoRef.current;
      if (video && !video.paused) {
        setShowControls(false);
      }
    }, 3000);
    controlsTimeoutRef.current = timeout;
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
      }
      if (unmuteCleanupRef.current) {
        unmuteCleanupRef.current();
      }
    };
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFs = !!document.fullscreenElement;
      isFullscreenRef.current = isFs;

      // Notify BackgroundScene to pause/resume animation
      window.dispatchEvent(new CustomEvent("iptv-fullscreen", { detail: { isFullscreen: isFs } }));

      // Update state synchronously so CSS classes match immediately
      setIsFullscreen(isFs);
      if (!isFs) {
        setIsRotated(false);
        const orientation = window.screen?.orientation as unknown as {
          type: string;
          angle: number;
          lock?: (orientation: "portrait" | "landscape" | "portrait-primary" | "portrait-secondary" | "landscape-primary" | "landscape-secondary" | "any" | "natural") => Promise<void>;
          unlock?: () => void;
        };
        if (
          window.screen &&
          orientation &&
          typeof orientation.unlock === "function"
        ) {
          orientation.unlock();
        }
      }
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    if (isRotated) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isRotated]);

  useEffect(() => {
    if (selectedChannel) {
      setFocusedChannelId(selectedChannel.id);
    }
  }, [selectedChannel]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore key events if user is typing in input elements
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          activeEl.hasAttribute("contenteditable"))
      ) {
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        if (document.fullscreenElement) {
          document.exitFullscreen().catch((err) => console.warn("Exit fullscreen failed:", err));
        }
        setIsRotated(false);
        setIsSportsHudOpen(false);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        if (isSportsHudOpen) {
          setIsSportsHudOpen(false);
        } else if (document.fullscreenElement) {
          document.exitFullscreen().catch((err) => console.warn("Exit fullscreen failed:", err));
        } else if (selectedChannelRef.current) {
          setSelectedChannel(null);
          setPlayerStatus("idle");
          if (hlsRef.current) {
            hlsRef.current.destroy();
            hlsRef.current = null;
          }
          if (shakaPlayerRef.current) {
            shakaPlayerRef.current.destroy();
            shakaPlayerRef.current = null;
          }
          if (videoRef.current) {
            videoRef.current.src = "";
          }
          if (unmuteCleanupRef.current) {
            unmuteCleanupRef.current();
          }
          loadedUrlRef.current = null;
        }
      } else if (e.key === "s" || e.key === "S") {
        setIsSportsHudOpen((prev) => !prev);
      } else if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        handleFullscreen();
      } else if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        handleMuteUnmute();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const video = videoRef.current;
        if (video) {
          const newVol = Math.min(1.0, video.volume + 0.05);
          video.volume = newVol;
          video.muted = false;
          setVolume(newVol);
          setIsMuted(false);
          userMutedRef.current = false;
          resetControlsTimeout();
        }
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        const video = videoRef.current;
        if (video) {
          const newVol = Math.max(0.0, video.volume - 0.05);
          video.volume = newVol;
          setVolume(newVol);
          if (newVol === 0) {
            video.muted = true;
            setIsMuted(true);
            userMutedRef.current = true;
          } else {
            video.muted = false;
            setIsMuted(false);
            userMutedRef.current = false;
          }
          resetControlsTimeout();
        }
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        const list = filteredChannelsRef.current;
        if (list.length === 0) return;
        const currentIdx = list.findIndex((c) => c.id === focusedChannelIdRef.current);
        let nextIdx = 0;
        if (currentIdx !== -1) {
          nextIdx = (currentIdx + 1) % list.length;
        } else if (selectedChannelRef.current) {
          const selIdx = list.findIndex((c) => c.id === selectedChannelRef.current?.id);
          if (selIdx !== -1) {
            nextIdx = (selIdx + 1) % list.length;
          }
        }
        const nextChan = list[nextIdx];
        setFocusedChannelId(nextChan.id);

        // Scroll into view
        const container = channelListRef.current;
        if (container) {
          const row = Math.floor(nextIdx / gridColumns);
          const rowTop = row * (VIRTUAL_ROW_HEIGHT + VIRTUAL_GAP);
          const rowBottom = rowTop + VIRTUAL_ROW_HEIGHT;
          if (rowTop < container.scrollTop) {
            container.scrollTop = rowTop;
          } else if (rowBottom > container.scrollTop + container.clientHeight) {
            container.scrollTop = rowBottom - container.clientHeight;
          }
        }
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        const list = filteredChannelsRef.current;
        if (list.length === 0) return;
        const currentIdx = list.findIndex((c) => c.id === focusedChannelIdRef.current);
        let prevIdx = 0;
        if (currentIdx !== -1) {
          prevIdx = (currentIdx - 1 + list.length) % list.length;
        } else if (selectedChannelRef.current) {
          const selIdx = list.findIndex((c) => c.id === selectedChannelRef.current?.id);
          if (selIdx !== -1) {
            prevIdx = (selIdx - 1 + list.length) % list.length;
          }
        }
        const prevChan = list[prevIdx];
        setFocusedChannelId(prevChan.id);

        // Scroll into view
        const container = channelListRef.current;
        if (container) {
          const row = Math.floor(prevIdx / gridColumns);
          const rowTop = row * (VIRTUAL_ROW_HEIGHT + VIRTUAL_GAP);
          const rowBottom = rowTop + VIRTUAL_ROW_HEIGHT;
          if (rowTop < container.scrollTop) {
            container.scrollTop = rowTop;
          } else if (rowBottom > container.scrollTop + container.clientHeight) {
            container.scrollTop = rowBottom - container.clientHeight;
          }
        }
      } else if (e.key === "Enter") {
        const active = document.activeElement;
        if (active && (active.tagName === "BUTTON" || active.tagName === "A" || active.tagName === "INPUT")) {
          return;
        }
        if (focusedChannelIdRef.current) {
          e.preventDefault();
          const list = filteredChannelsRef.current;
          const chan = list.find((c) => c.id === focusedChannelIdRef.current);
          if (chan) {
            handleChannelSelect(chan);
          }
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [gridColumns]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => setIsPaused(false);
    const handlePause = () => setIsPaused(true);
    const handleVolumeChange = () => {
      setIsMuted(video.muted);
      setVolume(video.volume);
    };

    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("volumechange", handleVolumeChange);

    setIsPaused(video.paused);
    setIsMuted(video.muted);
    setVolume(video.volume);

    return () => {
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("volumechange", handleVolumeChange);
    };
  }, [selectedChannel, retryKey]);

  const handlePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      if (video.muted && !userMutedRef.current) {
        video.muted = false;
        setIsMuted(false);
        if (video.volume === 0) {
          video.volume = 1.0;
          setVolume(1.0);
        }
      }
      video.play().catch((err) => {
        if (err.name !== "AbortError") {
          console.warn("Play failed:", err);
        }
      });
    } else {
      video.pause();
    }
    resetControlsTimeout();
  };

  const handleMuteUnmute = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.muted) {
      video.muted = false;
      userMutedRef.current = false;
      if (video.volume === 0) {
        video.volume = 1.0;
        setVolume(1.0);
      }
    } else {
      video.muted = true;
      userMutedRef.current = true;
    }
    resetControlsTimeout();
  };

  const handleVolumeChangeSlider = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const video = videoRef.current;
    if (!video) return;
    const newVol = parseFloat(e.target.value);
    video.volume = newVol;
    setVolume(newVol);
    if (newVol > 0) {
      video.muted = false;
      userMutedRef.current = false;
    } else {
      video.muted = true;
      userMutedRef.current = true;
    }
    resetControlsTimeout();
  };

  const handleFullscreen = () => {
    const container = playerContainerRef.current;
    if (!container) return;
    if (!document.fullscreenElement) {
      container
        .requestFullscreen()
        .then(() => {
          const orientation = window.screen?.orientation as unknown as {
            type: string;
            angle: number;
            lock?: (orientation: "portrait" | "landscape" | "portrait-primary" | "portrait-secondary" | "landscape-primary" | "landscape-secondary" | "any" | "natural") => Promise<void>;
            unlock?: () => void;
          };
          if (
            window.screen &&
            orientation &&
            typeof orientation.lock === "function"
          ) {
            orientation
              .lock("landscape")
              .catch((err) => console.warn("Auto lock landscape failed:", err));
          }
        })
        .catch((err) => console.warn("Fullscreen request failed:", err));
    } else {
      document
        .exitFullscreen()
        .catch((err) => console.warn("Exit fullscreen failed:", err));
    }
    resetControlsTimeout();
  };

  const handleSeek = (seconds: number) => {
    const video = videoRef.current;
    if (!video) return;

    try {
      const seekable = video.seekable;
      let newTime = video.currentTime + seconds;

      if (seekable && seekable.length > 0) {
        const start = seekable.start(0);
        const end = seekable.end(seekable.length - 1);
        if (newTime < start) newTime = start;
        if (newTime > end) newTime = end;
      } else if (video.duration) {
        if (newTime < 0) newTime = 0;
        if (newTime > video.duration) newTime = video.duration;
      }

      video.currentTime = newTime;
    } catch (err) {
      console.warn("Seeking failed:", err);
    }
    resetControlsTimeout();
  };

  // Sync isPip state with video element events
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleEnterPip = () => setIsPip(true);
    const handleLeavePip = () => setIsPip(false);

    video.addEventListener("enterpictureinpicture", handleEnterPip);
    video.addEventListener("leavepictureinpicture", handleLeavePip);

    return () => {
      video.removeEventListener("enterpictureinpicture", handleEnterPip);
      video.removeEventListener("leavepictureinpicture", handleLeavePip);
    };
  }, [selectedChannel, retryKey]);

  const handlePip = async () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled) {
        await video.requestPictureInPicture();
      }
    } catch (err) {
      console.warn("Failed to toggle Picture-in-Picture:", err);
    }
    resetControlsTimeout();
  };

  const isPipSupported =
    typeof document !== "undefined" && document.pictureInPictureEnabled;

  const handlePlayerClick = (e: React.MouseEvent) => {
    if (
      (e.target as HTMLElement).closest(".player-controls") ||
      (e.target as HTMLElement).closest(".desktop-seek-btn")
    ) {
      return;
    }

    const video = videoRef.current;
    if (video && (video.muted || video.volume === 0)) {
      video.muted = false;
      setIsMuted(false);
      if (video.volume === 0) {
        video.volume = 1.0;
        setVolume(1.0);
      }
      resetControlsTimeout();
      return;
    }

    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
      return;
    }

    clickTimeoutRef.current = setTimeout(() => {
      handlePlayPause();
      clickTimeoutRef.current = null;
    }, 200);
  };

  const handlePlayerDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (
      (e.target as HTMLElement).closest(".player-controls") ||
      (e.target as HTMLElement).closest(".desktop-seek-btn")
    ) {
      return;
    }

    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
    }

    const container = playerContainerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const isLeft = clickX < width / 2;

    handleSeek(isLeft ? -10 : 10);

    if (seekIndicatorTimeoutRef.current) {
      clearTimeout(seekIndicatorTimeoutRef.current);
    }
    setActiveSeekIndicator({
      side: isLeft ? "left" : "right",
      visible: true,
    });

    seekIndicatorTimeoutRef.current = setTimeout(() => {
      setActiveSeekIndicator((prev) => ({ ...prev, visible: false }));
    }, 650);
  };

  const handleMouseMove = () => {
    resetControlsTimeout();
  };

  // Hydrate playlists from localStorage on client-side mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("iptv_saved_playlists");
      const savedActiveId = localStorage.getItem("iptv_active_playlist_id");

      if (saved) {
        const parsedSaved = JSON.parse(saved) as Playlist[];
        const customPlaylists = parsedSaved.filter(p => p.id !== "default");

        setTimeout(() => {
          setPlaylists(prev => [
            prev[0], // Keep default
            ...customPlaylists
          ]);
        }, 0);
      }

      if (savedActiveId) {
        setTimeout(() => {
          setActivePlaylistId(savedActiveId);
        }, 0);
      }
    } catch (e) {
      console.error("Failed to load playlists from localStorage:", e);
    }
  }, []);

  // Save custom playlists to localStorage whenever they change
  useEffect(() => {
    if (playlists.length <= 1 && playlists[0].channels.length === 0) return;
    try {
      const customPlaylists = playlists.filter(p => p.id !== "default");
      localStorage.setItem("iptv_saved_playlists", JSON.stringify(customPlaylists));
    } catch (e) {
      console.error("Failed to save playlists to localStorage:", e);
    }
  }, [playlists]);

  // Sync activePlaylistId to localStorage
  useEffect(() => {
    if (activePlaylistId) {
      localStorage.setItem("iptv_active_playlist_id", activePlaylistId);
    }
  }, [activePlaylistId]);

  const handleSearchSubmit = useCallback(() => {
    setSubmittedSearchQuery(searchQuery.trim());
  }, [searchQuery]);

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSearchSubmit();
      }
    },
    [handleSearchSubmit]
  );

  const fetchDefaultChannels = useCallback(
    async (offset = 0, mode: "replace" | "append" = "replace") => {
      const fetchId = ++defaultFetchIdRef.current;

      try {
        if (mode === "replace") {
          setLoading(true);
        } else {
          setLoadingMore(true);
        }

        const params = new URLSearchParams({
          limit: String(CHANNEL_PAGE_SIZE),
          offset: String(offset),
          search: submittedSearchQuery,
          category: selectedCategory,
        });
        const response = await fetch(`/api/iptv/channels?${params.toString()}`);

        if (!response.ok) {
          throw new Error(`Failed to load channels (Status ${response.status})`);
        }

        const data = (await response.json()) as ChannelsResponse;
        if (fetchId !== defaultFetchIdRef.current) return;

        setDefaultCategories(data.categories);
        setChannelTotal(data.total);
        setHasMoreChannels(data.hasMore);
        setNextChannelOffset(data.nextOffset);
        const mergedChannels =
          mode === "append"
            ? [...channelsRef.current, ...data.channels]
            : data.channels;
        channelsRef.current = mergedChannels;
        setChannels(mergedChannels);
        setSelectedChannel((current) => {
          if (current && mergedChannels.some((channel) => channel.id === current.id || channel.url === current.url)) {
            return current;
          }

          return (
            mergedChannels.find(
              (channel) =>
                channel.name.toLowerCase().includes("t sports") ||
                channel.name.toLowerCase().includes("t-sports")
            ) ||
            mergedChannels[0] ||
            null
          );
        });
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : "Failed to load channel list. Please try again.";
        console.error("Error fetching channels:", err);
        setError(message);
      } finally {
        if (fetchId === defaultFetchIdRef.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [submittedSearchQuery, selectedCategory]
  );

  const fetchFifaChannels = useCallback(async () => {
    if (fifaChannels.length > 0) return; // already cached
    setFifaLoading(true);
    try {
      const res = await fetch("/api/iptv/fifa");
      if (!res.ok) throw new Error(`FIFA fetch failed (Status ${res.status})`);
      const data = (await res.json()) as { channels: Channel[]; total: number };
      setFifaChannels(data.channels);
    } catch (err) {
      console.error("Error fetching FIFA channels:", err);
    } finally {
      setFifaLoading(false);
    }
  }, [fifaChannels.length]);

  // 1. Fetch built-in channels in pages instead of loading the whole dataset
  useEffect(() => {
    if (activePlaylistId !== "default") return;

    const animationFrame = requestAnimationFrame(() => {
      setListScrollTop(0);
      if (channelListRef.current) {
        channelListRef.current.scrollTop = 0;
      }
    });

    const timeout = setTimeout(() => {
      fetchDefaultChannels(0, "replace");
    }, 0);

    return () => {
      cancelAnimationFrame(animationFrame);
      clearTimeout(timeout);
    };
  }, [activePlaylistId, submittedSearchQuery, selectedCategory, fetchDefaultChannels]);

  // FIFA channels: fetch lazily when the FIFA World Cup category pill is selected
  useEffect(() => {
    if (selectedCategory === "FIFA World Cup" && activePlaylistId === "default") {
      fetchFifaChannels();
    }
  }, [selectedCategory, activePlaylistId, fetchFifaChannels]);

  // Sync active playlist channels to standard list representation
  useEffect(() => {
    if (activePlaylistId === "default") return;

    const currentPlaylist = playlists.find(p => p.id === activePlaylistId);
    if (currentPlaylist) {
      const selectedChannelId = selectedChannel?.id;
      const selectedChannelUrl = selectedChannel?.url;

      setTimeout(() => {
        channelsRef.current = currentPlaylist.channels;
        setChannels(currentPlaylist.channels);
        setChannelTotal(currentPlaylist.channels.length);
        setHasMoreChannels(false);
        setNextChannelOffset(0);
        setLoading(false);
        setLoadingMore(false);

        if (currentPlaylist.channels.length > 0) {
          const alreadySelected = currentPlaylist.channels.find(
            c => c.id === selectedChannelId || c.url === selectedChannelUrl
          );
          if (!alreadySelected) {
            const defaultChan = currentPlaylist.channels.find(
              (c: Channel) =>
                c.name.toLowerCase().includes("t sports") ||
                c.name.toLowerCase().includes("t-sports")
            );
            setSelectedChannel(defaultChan || currentPlaylist.channels[0]);
          }
        } else {
          setSelectedChannel(null);
        }
      }, 0);
    }
  }, [activePlaylistId, playlists, selectedChannel?.id, selectedChannel?.url]);

  // M3U & JSON Parsing Helpers
  const parseM3U = (text: string): Channel[] => {
    const lines = text.split(/\r?\n/);
    const parsedChannels: Channel[] = [];
    let currentChannel: Partial<Channel> = {};

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      if (line.startsWith("#EXTINF:")) {
        currentChannel = {};

        const logoMatch = line.match(/(?:tvg-logo|logo)="([^"]+)"/i);
        if (logoMatch) currentChannel.logo = logoMatch[1];

        const groupMatch = line.match(/(?:group-title|tvg-group|group)="([^"]+)"/i);
        if (groupMatch) currentChannel.group = groupMatch[1];

        const commaIndex = line.lastIndexOf(",");
        if (commaIndex !== -1) {
          currentChannel.name = line.substring(commaIndex + 1).trim();
        }
      } else if (
        line.startsWith("http://") ||
        line.startsWith("https://") ||
        (line && !line.startsWith("#"))
      ) {
        if (currentChannel.name || line.includes("index.m3u8") || line.includes(".m3u8") || line.includes(".mp4")) {
          currentChannel.url = line;
          if (!currentChannel.name) {
            const parts = line.split("/");
            currentChannel.name = parts[parts.length - 1] || "Channel " + (parsedChannels.length + 1);
          }
          currentChannel.id = `custom-ch-${parsedChannels.length}-${Date.now()}`;
          if (!currentChannel.group) currentChannel.group = "Custom";
          if (!currentChannel.logo) currentChannel.logo = "";

          parsedChannels.push(currentChannel as Channel);
        }
        currentChannel = {};
      }
    }

    return parsedChannels;
  };

  interface RawChannelInput {
    id?: string;
    name?: string;
    title?: string;
    logo?: string;
    logoUrl?: string;
    image?: string;
    group?: string;
    category?: string;
    url?: string;
    streamUrl?: string;
    link?: string;
  }

  const parseJSON = (text: string): Channel[] => {
    const data = JSON.parse(text);
    const list = Array.isArray(data) ? data : data.channels || data.items || [];
    if (!Array.isArray(list)) {
      throw new Error("Invalid playlist JSON format. Expected an array of channels.");
    }
    return list.map((ch: RawChannelInput, idx: number) => {
      const url = ch.url || ch.streamUrl || ch.link;
      if (!url) throw new Error(`Channel at index ${idx} is missing a streaming URL ('url')`);
      return {
        id: ch.id || `custom-json-${idx}-${Date.now()}`,
        name: ch.name || ch.title || `Channel ${idx + 1}`,
        logo: ch.logo || ch.logoUrl || ch.image || "",
        group: ch.group || ch.category || "Custom",
        url: url,
      };
    });
  };

  // Custom playlist handlers
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportError(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        let parsed: Channel[] = [];

        if (file.name.endsWith(".json")) {
          parsed = parseJSON(text);
        } else {
          parsed = parseM3U(text);
        }

        if (parsed.length === 0) {
          throw new Error("No channels could be parsed from this file.");
        }

        const name = file.name.replace(/\.[^/.]+$/, "");
        const newPlaylist: Playlist = {
          id: `playlist-${Date.now()}`,
          name: name,
          type: "upload",
          channels: parsed,
        };

        setPlaylists(prev => [...prev, newPlaylist]);
        setActivePlaylistId(newPlaylist.id);
        setPlaylistTab("browse");
        if (fileInputRef.current) fileInputRef.current.value = "";
      } catch (err) {
        setImportError(
          err instanceof Error
            ? err.message
            : "Failed to parse file. Ensure it is a valid M3U or JSON playlist."
        );
      }
    };
    reader.onerror = () => {
      setImportError("Error reading file.");
    };
    reader.readAsText(file);
  };

  const handleUrlImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importUrl) return;

    setIsImporting(true);
    setImportError(null);

    try {
      const proxiedUrl = `/api/iptv/proxy?url=${encodeURIComponent(importUrl.trim())}`;
      const res = await fetch(proxiedUrl);
      if (!res.ok) {
        throw new Error(`Failed to fetch from URL (Status ${res.status})`);
      }

      const text = await res.text();
      let parsed: Channel[] = [];

      const trimmedText = text.trim();
      if (trimmedText.startsWith("[") || trimmedText.startsWith("{")) {
        parsed = parseJSON(text);
      } else {
        parsed = parseM3U(text);
      }

      if (parsed.length === 0) {
        throw new Error("No channels could be parsed from this URL.");
      }

      let name = playlistName.trim();
      if (!name) {
        try {
          const urlObj = new URL(importUrl);
          name = urlObj.hostname + urlObj.pathname.substring(urlObj.pathname.lastIndexOf("/"));
          name = name.replace(/\.[^/.]+$/, "");
        } catch {
          name = "Imported URL Playlist";
        }
      }

      const newPlaylist: Playlist = {
        id: `playlist-${Date.now()}`,
        name: name,
        type: "url",
        url: importUrl,
        channels: parsed,
      };

      setPlaylists(prev => [...prev, newPlaylist]);
      setActivePlaylistId(newPlaylist.id);
      setImportUrl("");
      setPlaylistName("");
      setPlaylistTab("browse");
    } catch (err) {
      setImportError(
        err instanceof Error
          ? err.message
          : "Failed to import from URL. Please check the link or CORS policy."
      );
    } finally {
      setIsImporting(false);
    }
  };

  const handleDeletePlaylist = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (id === "default") return;

    setPlaylists(prev => {
      const updated = prev.filter(p => p.id !== id);
      if (activePlaylistId === id) {
        setActivePlaylistId("default");
      }
      return updated;
    });
  };

  // 2. Initialize Hls.js/Native player and load stream
  const initializeStream = useCallback(
    async (chan: Channel, isUserClick: boolean) => {
      const video = videoRef.current;
      if (!video) return;

      const urlToLoad = chan.url;
      setPlayerStatus("loading");
      setPlayerError(null);
      loadedUrlRef.current = urlToLoad;

      if (isUserClick) {
        if (!userMutedRef.current) {
          video.muted = false;
          setIsMuted(false);
          if (video.volume === 0) {
            video.volume = 1.0;
            setVolume(1.0);
          }
        } else {
          video.muted = true;
          setIsMuted(true);
        }
      } else {
        video.volume = volumeRef.current;
        video.muted = isMutedRef.current;
      }

      // 1. Clean up Hls.js
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      // 2. Clean up Shaka Player
      if (shakaPlayerRef.current) {
        try {
          await shakaPlayerRef.current.destroy();
        } catch (e) {
          console.error("Error destroying Shaka Player:", e);
        }
        shakaPlayerRef.current = null;
      }

      // Reset video sources
      video.src = "";
      video.removeAttribute("src");
      try {
        video.load();
      } catch (e) {
        // Ignore load interruption
      }

      // Check if another stream started loading while we were clearing the player
      if (loadedUrlRef.current !== urlToLoad) return;

      const format = getStreamFormat(urlToLoad);

      // ── Early DRM / Secure Context check ─────────────────────────────────
      // Do this before loading Shaka so we can surface a clear error immediately
      // instead of letting it fail silently mid-load.
      if (chan.kid?.trim() && chan.key?.trim()) {
        if (typeof window !== "undefined" && !window.isSecureContext) {
          setPlayerError(
            "This channel uses DRM encryption and requires a secure connection (HTTPS or localhost). " +
            "Please access the app via HTTPS or localhost to watch this stream."
          );
          setPlayerStatus("error");
          return;
        }
      }

      if (format === "dash") {
        try {
          // Dynamically import shaka-player
          // @ts-ignore
          const shakaModule = await import("shaka-player/dist/shaka-player.compiled");
          const shaka: any = (shakaModule.default && shakaModule.default.Player) ? shakaModule.default : shakaModule;

          // Check if another stream started loading during import
          if (loadedUrlRef.current !== urlToLoad) return;

          // Install polyfills
          if (shaka?.polyfill && typeof shaka.polyfill.installAll === "function") {
            shaka.polyfill.installAll();
          }

          if (shaka?.Player && typeof shaka.Player.isBrowserSupported === "function" && shaka.Player.isBrowserSupported()) {
            const player = new shaka.Player(video);
            shakaPlayerRef.current = player;

            player.addEventListener("error", (event: any) => {
              if (event.detail && shaka?.util?.Error?.Severity && event.detail.severity === shaka.util.Error.Severity.CRITICAL) {
                console.error("Critical Shaka Error:", event.detail);
                setPlayerError(`Critical DASH Error: Code ${event.detail.code}`);
                setPlayerStatus("error");
              }
            });

            // Configure ClearKeys DRM if provided
            if (chan.kid?.trim() && chan.key?.trim()) {
              player.configure({
                drm: {
                  clearKeys: {
                    [chan.kid.trim()]: chan.key.trim()
                  }
                }
              });
            }

            await player.load(urlToLoad);

            if (loadedUrlRef.current !== urlToLoad) return;

            if (!video.paused) {
              setPlayerStatus("playing");
              setIsPaused(false);
              return;
            }

            video
              .play()
              .then(() => {
                if (loadedUrlRef.current !== urlToLoad) return;
                setPlayerStatus("playing");
                setIsPaused(false);
              })
              .catch((err) => {
                if (loadedUrlRef.current !== urlToLoad) return;
                if (err.name === "NotAllowedError") {
                  video.muted = true;
                  setIsMuted(true);
                  video
                    .play()
                    .then(() => {
                      if (loadedUrlRef.current !== urlToLoad) return;
                      setPlayerStatus("playing");
                      setIsPaused(false);
                      setupUnmuteOnInteraction();
                    })
                    .catch((playErr) => {
                      if (loadedUrlRef.current !== urlToLoad) return;
                      if (playErr.name !== "AbortError") console.error("Muted Shaka autoplay failed:", playErr);
                      setPlayerStatus("playing");
                      setIsPaused(true);
                    });
                } else {
                  if (err.name !== "AbortError") console.warn("Shaka play failed:", err);
                  setPlayerStatus("playing");
                  setIsPaused(video.paused);
                }
              });
          } else {
            setPlayerError("Your browser does not support DASH stream playback.");
            setPlayerStatus("error");
          }
        } catch (err: any) {
          try {
            // Prefer detailed error output: message, code, category, stack, and own keys
            if (err instanceof Error) {
              console.error("Shaka Player error:", err.message, { code: err.code, category: err.category, stack: err.stack });
            } else {
              const repr = (() => {
                try {
                  return JSON.stringify(err);
                } catch (e) {
                  return String(err);
                }
              })();
              console.error("Shaka Player error (raw):", repr, "keys:", Object.keys(err || {}));
            }
          } catch (logErr) {
            // Fallback if logging itself throws
            console.error("Shaka Player error (logging failed)", logErr, "original:", err);
          }

          let displayError = "Error loading DASH stream.";
          if (err?.code === 6001 || (typeof window !== "undefined" && !window.isSecureContext)) {
            displayError = "This stream requires a secure connection (HTTPS). Please access the app via HTTPS or localhost.";
          } else if (err?.code === 1001) {
            displayError = "The stream server is offline, unreachable, or geo-restricted.";
          } else if (err?.code === 1002) {
            displayError = "The stream server returned an invalid response. It may be geo-restricted or temporarily down.";
          } else if (err?.code === 6007) {
            displayError = "Stream is encrypted but no decryption keys were found. Check the channel's DRM configuration.";
          } else if (err?.code === 6012) {
            displayError = "Failed to apply DRM licence. Check your browser's protected content settings.";
          } else if (err?.message) {
            displayError = `DASH Error: ${err.message}`;
          } else if (err?.code) {
            displayError = `DASH Error: Code ${err.code} (Category: ${err.category})`;
          }

          setPlayerError(displayError);
          setPlayerStatus("error");
        }
      } else {
        // HLS or unknown format — try HLS.js first, fall back to native
        const isSafari = isSafariBrowser();

        if (Hls.isSupported() && !isSafari) {
          const hls = new Hls({
            enableWorker: true,
  lowLatencyMode: true,
  backBufferLength: 5,
  startLevel: -1,
  maxBufferLength: 8,
  liveSyncDurationCount: 2,
  liveMaxLatencyDurationCount: 5,
  fragLoadingTimeOut: 20000,
  manifestLoadingTimeOut: 20000,
          });
          hlsRef.current = hls;

          // ── HLS Manifest Timeout ──────────────────────────────────────────
          // If MANIFEST_PARSED never fires within 15 seconds, the stream is
          // likely offline, geo-blocked, or returning non-HLS content.
          let manifestReceived = false;
          const hlsTimeoutId = setTimeout(() => {
            if (!manifestReceived && loadedUrlRef.current === urlToLoad) {
              hls.destroy();
              hlsRef.current = null;
              setPlayerError(
                "Stream failed to load within 15 seconds. " +
                "It may be offline, geo-restricted, or blocked by your network. " +
                "Try clicking Retry or choose another channel."
              );
              setPlayerStatus("error");
            }
          }, 15_000);

          hls.attachMedia(video);
          hls.loadSource(urlToLoad);

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            manifestReceived = true;
            clearTimeout(hlsTimeoutId);
            if (loadedUrlRef.current !== urlToLoad) return;
            if (!video.paused) {
              setPlayerStatus("playing");
              setIsPaused(false);
              return;
            }

            video
              .play()
              .then(() => {
                if (loadedUrlRef.current !== urlToLoad) return;
                setPlayerStatus("playing");
                setIsPaused(false);
              })
              .catch((err) => {
                if (loadedUrlRef.current !== urlToLoad) return;
                if (err.name === "NotAllowedError") {
                  video.muted = true;
                  setIsMuted(true);
                  video
                    .play()
                    .then(() => {
                      if (loadedUrlRef.current !== urlToLoad) return;
                      setPlayerStatus("playing");
                      setIsPaused(false);
                      setupUnmuteOnInteraction();
                    })
                    .catch((playErr) => {
                      if (loadedUrlRef.current !== urlToLoad) return;
                      if (playErr.name !== "AbortError") console.error("Muted autoplay failed:", playErr);
                      setPlayerStatus("playing");
                      setIsPaused(true);
                    });
                } else {
                  if (err.name !== "AbortError") console.warn("Play failed:", err);
                  setPlayerStatus("playing");
                  setIsPaused(video.paused);
                }
              });
          });

          // Track consecutive network error retries to avoid infinite loops
          let networkRetries = 0;
          hls.on(Hls.Events.ERROR, (_event: string, data: { fatal: boolean; type: string; details?: string }) => {
            if (loadedUrlRef.current !== urlToLoad) return;
            if (data.fatal) {
              clearTimeout(hlsTimeoutId);
              switch (data.type) {
                case Hls.ErrorTypes.NETWORK_ERROR:
                  networkRetries++;
                  if (networkRetries <= 2) {
                    console.warn(`Fatal HLS network error (attempt ${networkRetries}), retrying...`);
                    hls.startLoad();
                  } else {
                    console.error("HLS network error: too many retries.", data);
                    setPlayerError(
                      "Stream is unreachable. It may be offline, geo-blocked, or your network is blocking it. " +
                      "Try Retry or select a different channel."
                    );
                    setPlayerStatus("error");
                  }
                  break;
                case Hls.ErrorTypes.MEDIA_ERROR:
                  console.warn("Fatal HLS media error, attempting to recover...");
                  hls.recoverMediaError();
                  break;
                default:
                  console.error("Fatal unrecoverable HLS error:", data);
                  setPlayerError("Stream error: " + (data.details || data.type) + ". The stream may be offline or incompatible.");
                  setPlayerStatus("error");
                  break;
              }
            }
          });
        } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = urlToLoad;

          const onLoadedMetadata = () => {
            if (loadedUrlRef.current !== urlToLoad) return;
            if (!video.paused) {
              setPlayerStatus("playing");
              setIsPaused(false);
              return;
            }

            video
              .play()
              .then(() => {
                if (loadedUrlRef.current !== urlToLoad) return;
                setPlayerStatus("playing");
                setIsPaused(false);
              })
              .catch((err) => {
                if (loadedUrlRef.current !== urlToLoad) return;
                if (err.name === "NotAllowedError") {
                  video.muted = true;
                  setIsMuted(true);
                  video
                    .play()
                    .then(() => {
                      if (loadedUrlRef.current !== urlToLoad) return;
                      setPlayerStatus("playing");
                      setIsPaused(false);
                      setupUnmuteOnInteraction();
                    })
                    .catch((playErr) => {
                      if (loadedUrlRef.current !== urlToLoad) return;
                      if (playErr.name !== "AbortError") {
                        console.error("Native muted autoplay failed:", playErr);
                      }
                      setPlayerStatus("playing");
                      setIsPaused(true);
                    });
                } else {
                  if (err.name !== "AbortError") {
                    console.warn("Native play failed:", err);
                  }
                  setPlayerStatus("playing");
                  setIsPaused(video.paused);
                }
              });
          };

          const onError = (e: Event) => {
            if (loadedUrlRef.current !== urlToLoad) return;
            console.error("Native video player error:", e);
            setPlayerError("Native video player error occurred while loading this stream.");
            setPlayerStatus("error");
          };

          video.addEventListener("loadedmetadata", onLoadedMetadata, {
            once: true,
          });
          video.addEventListener("error", onError, { once: true });
        } else {
          setPlayerError("Your browser does not support HLS stream playback.");
          setPlayerStatus("error");
        }
      }

      if (isUserClick) {
        video.play().catch((err) => {
          if (err.name !== "AbortError") {
            console.warn("Synchronous play gesture registered:", err);
          }
        });
      }
    },
    [setupUnmuteOnInteraction]
  );

  // 3. Play stream when a channel is selected or retryKey changes
  useEffect(() => {
    if (!selectedChannel) return;

    // On retry (retryKey increments), force re-initialization even if the URL
    // hasn't changed — loadedUrlRef is cleared so initializeStream runs.
    if (loadedUrlRef.current !== selectedChannel.url) {
      initializeStream(selectedChannel, false);
    }
  }, [selectedChannel, initializeStream]);

  // Retry: explicitly clear the loaded URL so initializeStream re-runs
  useEffect(() => {
    if (retryKey === 0) return;
    loadedUrlRef.current = null;
    if (selectedChannel) {
      initializeStream(selectedChannel, false);
    }
  }, [retryKey]); // intentionally only retryKey

  // Clean up Hls, Shaka, and video elements on component unmount
  useEffect(() => {
    const video = videoRef.current;
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (shakaPlayerRef.current) {
        shakaPlayerRef.current.destroy();
        shakaPlayerRef.current = null;
      }
      if (video) {
        video.src = "";
      }
      if (unmuteCleanupRef.current) {
        unmuteCleanupRef.current();
      }
      loadedUrlRef.current = null;
    };
  }, []);

  const handleReload = () => {
    loadedUrlRef.current = null;
    setRetryKey((prev) => prev + 1);
  };

  const handleChannelSelect = useCallback(
    (chan: Channel) => {
      setSelectedChannel(chan);
      initializeStream(chan, true);

      if (window.innerWidth < 1024 && playerWrapperRef.current) {
        setTimeout(() => {
          playerWrapperRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }, 100);
      }
    },
    [initializeStream]
  );

  const activePlaylist = playlists.find((p) => p.id === activePlaylistId);
  const isDefaultPlaylist = activePlaylistId === "default";
  const isFifaCategory = selectedCategory === "FIFA World Cup" && isDefaultPlaylist;

  const handleTuneToChannelByName = useCallback((channelName: string) => {
    // Try to find channel in current active playlist
    let match = activePlaylist?.channels.find(
      (c) => c.name.toLowerCase().includes(channelName.toLowerCase()) ||
             channelName.toLowerCase().includes(c.name.toLowerCase())
    );

    // Try in all playlists if not found
    if (!match) {
      for (const p of playlists) {
        match = p.channels.find(
          (c) => c.name.toLowerCase().includes(channelName.toLowerCase()) ||
                 channelName.toLowerCase().includes(c.name.toLowerCase())
        );
        if (match) break;
      }
    }

    if (match) {
      handleChannelSelect(match);
    } else {
      console.warn(`Broadcaster channel "${channelName}" not found.`);
    }
  }, [activePlaylist, playlists, handleChannelSelect]);

  const categories = useMemo(
    () =>
      isDefaultPlaylist
        ? defaultCategories
        : sortCategoriesByUsefulness([
          "All",
          ...Array.from(new Set(channels.map((c) => c.group))),
        ]),
    [channels, defaultCategories, isDefaultPlaylist]
  );

  // Inject "FIFA World Cup" right after "All" (before Sports) only for the Default TV playlist
  const displayedCategories = useMemo(() => {
    if (!isDefaultPlaylist) return categories;
    const allIdx = categories.indexOf("All");
    const injected = [...categories];
    injected.splice(allIdx + 1, 0, "FIFA World Cup");
    return injected;
  }, [categories, isDefaultPlaylist]);

  const filteredChannels = useMemo(() => {
    // FIFA World Cup: source from fifa.json, filtered by search
    if (isFifaCategory) {
      if (!submittedSearchQuery) return fifaChannels;
      return fifaChannels.filter((c) =>
        c.name.toLowerCase().includes(submittedSearchQuery.toLowerCase())
      );
    }

    if (isDefaultPlaylist) return channels;

    return channels.filter((c) => {
      const matchesCategory =
        selectedCategory === "All" || c.group === selectedCategory;
      const matchesSearch = c.name
        .toLowerCase()
        .includes(submittedSearchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [channels, fifaChannels, isFifaCategory, isDefaultPlaylist, submittedSearchQuery, selectedCategory]);

  const displayedChannelTotal = isFifaCategory
    ? filteredChannels.length
    : isDefaultPlaylist
      ? channelTotal
      : filteredChannels.length;

  useEffect(() => {
    const list = channelListRef.current;
    if (!list) return;

    const measure = () => {
      const width = list.clientWidth;
      const nextColumns =
        width >= 1024 ? 4 : width >= 768 ? 3 : width >= 640 ? 2 : 1;
      setGridColumns(nextColumns);
      setListHeight(list.clientHeight);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(list);

    return () => observer.disconnect();
  }, [filteredChannels.length, loading, playlistTab]);

  const maybeLoadMoreChannels = useCallback(() => {
    if (
      !isDefaultPlaylist ||
      isFifaCategory ||
      loading ||
      loadingMore ||
      !hasMoreChannels
    ) {
      return;
    }

    fetchDefaultChannels(nextChannelOffset, "append");
  }, [
    fetchDefaultChannels,
    hasMoreChannels,
    isFifaCategory,
    isDefaultPlaylist,
    loading,
    loadingMore,
    nextChannelOffset,
  ]);

  const handleChannelListScroll = useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      const target = event.currentTarget;
      setListScrollTop(target.scrollTop);

      if (
        target.scrollTop + target.clientHeight >=
        target.scrollHeight - CHANNEL_PREFETCH_DISTANCE
      ) {
        maybeLoadMoreChannels();
      }
    },
    [maybeLoadMoreChannels]
  );

  const virtualRows = Math.ceil(filteredChannels.length / gridColumns);
  const rowStride = VIRTUAL_ROW_HEIGHT + VIRTUAL_GAP;
  const overscanRows = Math.max(
    2,
    Math.ceil(VIRTUAL_OVERSCAN_CHANNELS / gridColumns)
  );
  const startRow = Math.max(
    0,
    Math.floor(listScrollTop / rowStride) - overscanRows
  );
  const visibleRowCount =
    Math.ceil((listHeight || 600) / rowStride) + overscanRows * 2;
  const endRow = Math.min(virtualRows, startRow + visibleRowCount);
  const virtualChannels = filteredChannels.slice(
    startRow * gridColumns,
    endRow * gridColumns
  );
  const virtualPaddingTop = startRow * rowStride;
  const virtualHeight = Math.max(virtualRows * rowStride - VIRTUAL_GAP, 0);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  // Sync keyboard navigation refs
  filteredChannelsRef.current = filteredChannels;
  selectedChannelRef.current = selectedChannel;
  focusedChannelIdRef.current = focusedChannelId;

  return (
    <div className="max-w-7xl mx-auto space-y-4 md:space-y-6 pt-4 md:pt-6 min-h-screen pb-12 px-3 sm:px-4 md:px-6 text-white">
      {error ? (
        <div className="glass-card p-12 text-center space-y-6 border border-rose-500/20 max-w-2xl mx-auto rounded-3xl bg-rose-500/5">
          <ShieldAlert className="text-rose-500 mx-auto" size={48} />
          <h3 className="text-2xl font-bold">Something went wrong</h3>
          <p className="text-gray-400 font-medium">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-primary hover:bg-primary-dark font-bold rounded-2xl transition-all shadow-lg shadow-primary/20"
          >
            Reload Page
          </button>
        </div>
      ) : loading ? (
        <div className="flex flex-col gap-6 max-w-6xl mx-auto w-full items-center animate-pulse">
          {/* 1. Player Card Skeleton */}
          <div className="w-full aspect-video rounded-2xl md:rounded-3xl bg-white/[0.01] border border-white/5 flex items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center">
              <Radio size={32} className="text-white/20 animate-pulse" />
            </div>
          </div>

          {/* 2. Middle Cards Skeletons */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
            {/* Card 1: Channel Details Skeleton */}
            <div className="glass-card p-4 sm:p-6 border border-white/5 rounded-2xl md:rounded-3xl flex flex-row items-center gap-4 bg-white/[0.01] w-full animate-pulse">
              <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-white/10 border border-white/10 flex-shrink-0" />
              <div className="space-y-2 flex-1">
                <div className="h-4 sm:h-5 bg-white/10 rounded w-2/3 animate-pulse" />
                <div className="h-3.5 bg-white/10 rounded w-1/3 animate-pulse" />
              </div>
            </div>

            {/* Card 2: Developer Info Skeleton */}
            <div className="glass-card p-4 sm:p-5 border border-white/5 rounded-2xl md:rounded-3xl flex flex-row items-center justify-between gap-4 bg-white/[0.01] w-full animate-pulse">
              {/* Left block skeleton */}
              <div className="flex items-center gap-3 flex-shrink-0">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/10 border border-white/10 flex-shrink-0" />
                <div className="space-y-2">
                  <div className="h-4 bg-white/10 rounded w-16 animate-pulse" />
                  <div className="flex gap-2.5">
                    <div className="w-4 h-4 bg-white/10 rounded animate-pulse" />
                    <div className="w-4 h-4 bg-white/10 rounded animate-pulse" />
                    <div className="w-4 h-4 bg-white/10 rounded animate-pulse" />
                  </div>
                </div>
              </div>
              {/* Separator skeleton */}
              <div className="hidden xs:block h-10 w-[1px] bg-white/10 flex-shrink-0" />
              {/* Right block skeleton */}
              <div className="space-y-1.5 flex-1 pl-1">
                <div className="h-2.5 bg-white/10 rounded w-11/12 animate-pulse" />
                <div className="h-2.5 bg-white/10 rounded w-4/5 animate-pulse" />
              </div>
            </div>

            {/* Card 3: Total Channels Count Skeleton */}
            <div className="glass-card p-4 sm:p-6 border border-white/5 rounded-2xl md:rounded-3xl flex flex-row items-center gap-4 bg-white/[0.01] w-full animate-pulse">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-white/10 border border-white/10 flex-shrink-0" />
              <div className="space-y-2 flex-1">
                <div className="h-4 bg-white/10 rounded w-1/3 animate-pulse" />
                <div className="h-5 bg-white/10 rounded w-1/2 animate-pulse" />
              </div>
            </div>
          </div>

          {/* 3. Channels List Skeleton Card */}
          <div className="w-full glass-card p-4 sm:p-6 border border-white/5 rounded-2xl md:rounded-3xl bg-white/[0.01] flex flex-col h-[550px] sm:h-[650px] gap-4">
            <div className="space-y-3 pb-3 border-b border-white/5">
              <div className="h-10 bg-white/5 rounded-xl sm:rounded-2xl w-full" />
              <div className="flex gap-2">
                <div className="h-8 bg-white/5 rounded-lg w-16" />
                <div className="h-8 bg-white/5 rounded-lg w-20" />
                <div className="h-8 bg-white/5 rounded-lg w-20" />
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 h-full">
                {Array.from({ length: 12 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2.5 sm:gap-3 p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-white/[0.02] border border-white/5"
                  >
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-white/10" />
                    <div className="flex-1 space-y-1.5 sm:space-y-2">
                      <div className="h-2.5 sm:h-3 w-1/3 bg-white/10 rounded" />
                      <div className="h-3.5 sm:h-4 w-2/3 bg-white/10 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-6 max-w-6xl mx-auto w-full items-center">
          {/* 1. Player Card */}
          <div
            ref={playerWrapperRef}
            className="w-full"
          >
            <div
              ref={playerContainerRef}
              onMouseMove={handleMouseMove}
              onClick={handlePlayerClick}
              onDoubleClick={handlePlayerDoubleClick}
              style={{ willChange: "transform" }}
              className={`bg-black shadow-2xl group ${isRotated
                  ? "fixed z-[9999] top-1/2 left-1/2 w-[100vh] h-[100vw] -translate-x-1/2 -translate-y-1/2 rotate-90 origin-center"
                  : isFullscreen
                    ? "relative w-full h-full bg-black"
                    : "relative aspect-video rounded-2xl md:rounded-3xl overflow-hidden bg-black border border-white/5 w-full"
                } ${showControls ? "cursor-default" : "cursor-none"
                }`}
            >
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-contain bg-black cursor-pointer"
              />

              {/* Tap to Unmute Overlay */}
              {playerStatus === "playing" && isMuted && (
                <div
                  className="absolute top-4 right-4 z-30 pointer-events-auto cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMuteUnmute();
                  }}
                >
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/70 hover:bg-black/90 text-white border border-white/10 shadow-lg backdrop-blur-md"
                  >
                    <VolumeX
                      size={14}
                      className="text-primary animate-pulse"
                    />
                    <span className="text-[10px] sm:text-xs font-bold tracking-wider">
                      TAP TO UNMUTE
                    </span>
                  </motion.div>
                </div>
              )}

              {/* Center Play Button Overlay when Paused */}
              {playerStatus === "playing" && isPaused && (
                <div
                  className="absolute inset-0 flex items-center justify-center bg-black/35 z-10 cursor-pointer transition-colors hover:bg-black/50"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePlayPause();
                  }}
                >
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    className="h-16 w-16 md:h-20 md:w-20 rounded-full bg-primary/95 text-white flex items-center justify-center shadow-lg shadow-primary/30 border border-white/10"
                  >
                    <Play
                      size={28}
                      className="fill-white translate-x-0.5 md:w-8 md:h-8"
                    />
                  </motion.div>
                </div>
              )}

              {/* YouTube-like Double Click Seek Visual Ripple Overlay */}
              <AnimatePresence>
                {activeSeekIndicator.visible && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className={`absolute inset-y-0 w-1/3 flex items-center justify-center pointer-events-none z-30 bg-white/5 ${activeSeekIndicator.side === "left"
                        ? "left-0 rounded-r-full"
                        : "right-0 rounded-l-full"
                      }`}
                  >
                    {activeSeekIndicator.side === "left" ? (
                      <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1.1, opacity: 1 }}
                        exit={{ scale: 0.8, opacity: 0 }}
                        className="flex flex-col items-center gap-1 text-white bg-black/60 px-4 py-3 rounded-full backdrop-blur-md border border-white/10"
                      >
                        <ChevronsLeft className="h-6 w-6 text-primary animate-pulse" />
                        <span className="text-xs font-black tracking-widest">
                          -10s
                        </span>
                      </motion.div>
                    ) : (
                      <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1.1, opacity: 1 }}
                        exit={{ scale: 0.8, opacity: 0 }}
                        className="flex flex-col items-center gap-1 text-white bg-black/60 px-4 py-3 rounded-full backdrop-blur-md border border-white/10"
                      >
                        <ChevronsRight className="h-6 w-6 text-primary animate-pulse" />
                        <span className="text-xs font-black tracking-widest">
                          +10s
                        </span>
                      </motion.div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Desktop Hover Seek Buttons */}
              <div className="absolute inset-y-0 left-0 w-16 flex items-center justify-start pl-4 pointer-events-none z-20">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSeek(-10);
                  }}
                  className="desktop-seek-btn pointer-events-auto h-12 w-12 rounded-full bg-black/50 hover:bg-primary/80 border border-white/10 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-all duration-300 transform -translate-x-4 group-hover:translate-x-0 cursor-pointer hidden md:flex"
                  title="Rewind 10s"
                >
                  <ChevronsLeft size={20} />
                </button>
              </div>

              <div className="absolute inset-y-0 right-0 w-16 flex items-center justify-end pr-4 pointer-events-none z-20">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSeek(10);
                  }}
                  className="desktop-seek-btn pointer-events-auto h-12 w-12 rounded-full bg-black/50 hover:bg-primary/80 border border-white/10 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-4 group-hover:translate-x-0 cursor-pointer hidden md:flex"
                  title="Forward 10s"
                >
                  <ChevronsRight size={20} />
                </button>
              </div>

              {/* Loader Overlay */}
              {playerStatus === "loading" && (
                <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-4 z-10">
                  <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm font-semibold tracking-wider text-primary animate-pulse">
                    Feaching LoopinLive Stream...
                  </span>
                </div>
              )}

              {/* Error/Offline Overlay */}
              {playerStatus === "error" && (
                <div className="absolute inset-0 bg-black/95 flex flex-col items-center justify-center gap-4 z-10 px-6 text-center backdrop-blur-sm">
                  <ShieldAlert className="text-rose-500 animate-pulse" size={44} />
                  <span className="text-base font-bold text-white tracking-wide">
                    Playback Failure
                  </span>
                  <span className="text-xs text-rose-400 font-semibold max-w-md bg-rose-500/10 border border-rose-500/20 px-4 py-2 rounded-xl">
                    {playerError || "Stream Currently Unavailable"}
                  </span>
                  <span className="text-xs text-gray-400 max-w-xs leading-relaxed">
                    The link may be offline, geoblocked, or requires secure connection.
                  </span>
                  
                  <div className="flex flex-wrap items-center justify-center gap-3 mt-2">
                    <button
                      onClick={() => selectedChannel && initializeStream(selectedChannel, true)}
                      className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-xs font-bold rounded-xl shadow-lg transition-all active:scale-95 cursor-pointer"
                    >
                      <RefreshCw size={12} />
                      <span>Retry Playback</span>
                    </button>

                    {lastSuccessfulChannel && lastSuccessfulChannel.id !== selectedChannel?.id && (
                      <button
                        onClick={() => handleChannelSelect(lastSuccessfulChannel)}
                        className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-xs font-bold rounded-xl border border-white/5 transition-all active:scale-95 cursor-pointer"
                      >
                        <span>Back to {lastSuccessfulChannel.name}</span>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setPlayerStatus("idle");
                        setPlayerError(null);
                        setSelectedChannel(null);
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-xs font-medium text-gray-300 rounded-xl border border-white/5 transition-all cursor-pointer"
                    >
                      <span>Dismiss / Browse</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Idle Overlay */}
              {playerStatus === "idle" && (
                <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-4 z-10">
                  <Radio
                    size={40}
                    className="text-gray-600 animate-pulse"
                  />
                  <span className="text-sm text-gray-400 font-medium">
                    Select a channel to play
                  </span>
                </div>
              )}

              {/* Custom Controls Overlay */}
              {playerStatus === "playing" && (
                <div
                  className={`player-controls absolute bottom-0 left-0 right-0 p-3 sm:p-4 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex items-center justify-between transition-all duration-300 z-20 ${showControls
                      ? "opacity-100 translate-y-0"
                      : "opacity-0 translate-y-2 pointer-events-none"
                    }`}
                >
                  {/* Left controls */}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handlePlayPause}
                      className="p-1.5 rounded-lg hover:bg-white/10 text-white transition-colors"
                    >
                      {isPaused ? (
                        <Play size={18} className="fill-white" />
                      ) : (
                        <Pause size={18} className="fill-white" />
                      )}
                    </button>
                    <div className="flex items-center gap-1.5 group/volume">
                      <button
                        onClick={handleMuteUnmute}
                        className="p-1.5 rounded-lg hover:bg-white/10 text-white transition-colors"
                      >
                        {isMuted || volume === 0 ? (
                          <VolumeX size={18} />
                        ) : (
                          <Volume2 size={18} />
                        )}
                      </button>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={isMuted ? 0 : volume}
                        onChange={handleVolumeChangeSlider}
                        className="w-16 sm:w-20 h-1.5 rounded-lg appearance-none cursor-pointer outline-none transition-all [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-none [&::-moz-range-thumb]:shadow-md"
                        style={{
                          background: `linear-gradient(to right, #8b5cf6 0%, #8b5cf6 ${(isMuted ? 0 : volume) * 100
                            }%, rgba(255, 255, 255, 0.25) ${(isMuted ? 0 : volume) * 100
                            }%, rgba(255, 255, 255, 0.25) 100%)`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Center LIVE badge */}
                  <div className="flex items-center gap-1 bg-rose-600/90 text-white font-bold text-[9px] tracking-wider uppercase px-2 py-0.5 rounded border border-rose-500/30 animate-pulse select-none">
                    <span className="h-1.5 w-1.5 rounded-full bg-white"></span>
                    <span>LIVE</span>
                  </div>

                  {/* Right controls */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsSportsHudOpen((prev) => !prev);
                      }}
                      className={`p-1.5 rounded-lg hover:bg-white/10 text-white transition-colors ${isSportsHudOpen ? "text-primary bg-white/10" : ""
                        }`}
                      title="Toggle Sports HUD Overlay (Press S)"
                    >
                      <Trophy size={18} />
                    </button>
                    {isPipSupported && (
                      <button
                        onClick={handlePip}
                        className={`p-1.5 rounded-lg hover:bg-white/10 text-white transition-colors ${isPip ? "text-primary bg-white/10" : ""
                          }`}
                        title="Picture in Picture"
                      >
                        <PictureInPicture size={18} />
                      </button>
                    )}
                    <button
                      onClick={handleReload}
                      className="p-1.5 rounded-lg hover:bg-white/10 text-white transition-colors"
                      title="Reload Stream"
                    >
                      <RotateCw size={18} />
                    </button>
                    <button
                      onClick={handleFullscreen}
                      className="p-1.5 rounded-lg hover:bg-white/10 text-white transition-colors"
                    >
                      {isFullscreen ? (
                        <Minimize size={18} />
                      ) : (
                        <Maximize size={18} />
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Sports HUD Overlay */}
              <SportsHudOverlay
                isOpen={isSportsHudOpen}
                onClose={() => setIsSportsHudOpen(false)}
                matches={footballMatches}
                loading={footballLoading}
              />
            </div>
          </div>

          {/* 2. Grid for Channel Details & Channel Count Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
            {/* Channel Details Card / Skeleton */}
            {selectedChannel ? (
              <motion.div
                key={selectedChannel.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`md:col-span-1 glass-card p-4 sm:p-6 border border-white/5 rounded-2xl md:rounded-3xl flex flex-row items-center justify-start gap-4 text-left bg-white/[0.01] w-full ${playerStatus === "loading" ? "animate-pulse" : ""
                  }`}
              >
                {selectedChannel.logo ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={selectedChannel.logo}
                    alt={selectedChannel.name}
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none";
                    }}
                    className="w-10 h-10 sm:w-14 sm:h-14 object-contain rounded-xl sm:rounded-2xl bg-white/5 p-0.5 sm:p-1 border border-white/10 flex-shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-primary/30 to-black-500/30 flex items-center justify-center font-bold text-sm sm:text-base text-primary border border-primary/20 flex-shrink-0">
                    {getInitials(selectedChannel.name)}
                  </div>
                )}
                <div className="space-y-1 min-w-0">
                  <h2 className="text-base sm:text-lg md:text-xl font-bold truncate">
                    {selectedChannel.name}
                  </h2>
                  <span className="text-[9px] sm:text-[10px] uppercase font-bold tracking-widest text-primary bg-primary/10 px-1.5 sm:px-2 py-0.5 rounded border border-primary/20 block w-fit">
                    {selectedChannel.group}
                  </span>
                </div>
              </motion.div>
            ) : (
              <div className="md:col-span-1 glass-card p-4 sm:p-6 border border-white/5 rounded-2xl md:rounded-3xl flex flex-row items-center justify-start gap-4 text-left bg-white/[0.01] w-full">
                <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-primary/10 border border-primary/20 flex-shrink-0 flex items-center justify-center">
                  <Tv size={20} className="text-primary" />
                </div>
                <div className="space-y-1 min-w-0">
                  <h2 className="text-base sm:text-lg font-bold text-gray-300">Select a Channel</h2>
                  <span className="text-[9px] sm:text-[10px] uppercase font-bold tracking-widest text-gray-500">Choose from the list below</span>
                </div>
              </div>
            )}

            {/* Developer Info Card */}
            <div className="glass-card p-4 sm:p-5 border border-white/5 rounded-2xl md:rounded-3xl flex flex-row items-center justify-between gap-4 text-left bg-white/[0.01] w-full md:col-span-1">
              {/* Left block: Avatar & Name/Socials */}
              <div className="flex items-center gap-3 flex-shrink-0">
                <div className="relative">
                  <div className="relative w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden border border-white/15 shadow-md">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="https://avatars.githubusercontent.com/u/61101893?v=4"
                      alt="Mitab Sany"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[#070414] z-10 animate-pulse" />
                </div>
                <div className="flex flex-col">
                  <h3 className="text-base sm:text-lg font-black text-white leading-tight">
                    Mitab Sany
                  </h3>
                  <div className="flex items-center gap-3 mt-1.5">
                    <a
                      href="https://github.com/thewiztanvir"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-400 hover:text-white transition-colors"
                      title="GitHub"
                    >
                      <FaGithub size={18} />
                    </a>
                    
                    <a
                      href="https://www.linkedin.com/in/mitabsany"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-400 hover:text-[#1877F2] transition-colors"
                      title="LinkedIn"
                    >
                      <FaLinkedin size={18} />
                    </a>
                    <a
                      href="https://youtube.com/@mitabsany"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-400 hover:text-[#FF0000] transition-colors"
                      title="YouTube"
                    >
                      <FaYoutube size={18} />
                    </a>
                  </div>
                </div>
              </div>

              {/* Vertical Separator */}
              <div className="hidden xs:block h-10 w-[1px] bg-white/10 flex-shrink-0" />

              {/* Right block: Support details */}
              <p className="text-[10px] sm:text-[10.5px] leading-normal text-gray-500 font-medium select-text flex-1 pl-1 min-w-[120px]">
                For any support, contact via <a href="mailto:mitabsany@gmail.com" target="_blank" rel="noopener noreferrer" className="text-[#26A5E4] font-bold hover:underline">Email only</a>. Follow GitHub for updates!
              </p>
            </div>

            {/* Channel Count Card */}
            <div className="glass-card p-4 sm:p-6 border border-white/5 rounded-2xl md:rounded-3xl flex flex-row items-center justify-start gap-4 text-left bg-white/[0.01] w-full md:col-span-1">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary flex-shrink-0">
                <Tv size={20} className="animate-pulse" />
              </div>
              <div className="space-y-0.5 min-w-0">
                <p className="text-[9px] sm:text-[10px] uppercase font-bold tracking-widest text-gray-500 truncate">
                  Total Channels
                </p>
                <h3 className="text-base sm:text-lg font-bold text-lime-400 truncate">
                  {displayedChannelTotal} Channels
                </h3>
              </div>
            </div>
          </div>

          {/* 3. Channel List Card */}
          <div className="w-full glass-card p-4 sm:p-6 border border-white/5 rounded-2xl md:rounded-3xl bg-white/[0.01] flex flex-col h-[600px] sm:h-[700px]">
            {/* Playlist Header & Tab Bar */}
            <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-white/5 flex-wrap gap-2">
              <div className="flex items-center bg-white/5 p-1 rounded-xl border border-white/5 flex-wrap">
                <button
                  onClick={() => setPlaylistTab("browse")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all ${playlistTab === "browse"
                      ? "bg-primary text-white shadow-lg shadow-primary/20"
                      : "text-gray-400 hover:text-white"
                    }`}
                >
                  <Tv size={14} />
                  <span>Browse Channels</span>
                </button>
                <button
                  onClick={() => setPlaylistTab("sports")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all ${playlistTab === "sports"
                      ? "bg-primary text-white shadow-lg shadow-primary/20"
                      : "text-gray-400 hover:text-white"
                    }`}
                >
                  <Trophy size={14} />
                  <span>Sports Hub</span>
                </button>
                <button
                  onClick={() => setPlaylistTab("manage")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all ${playlistTab === "manage"
                      ? "bg-primary text-white shadow-lg shadow-primary/20"
                      : "text-gray-400 hover:text-white"
                    }`}
                >
                  <Upload size={14} />
                  <span>Playlists Manager</span>
                </button>
              </div>

              {/* Display active playlist name */}
              <div className="text-[10px] sm:text-xs text-gray-400 bg-white/5 border border-white/5 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl max-w-[180px] sm:max-w-[260px] truncate select-none flex items-center gap-1.5 sm:gap-2">
                <span className="font-semibold shrink-0">Playlist:</span>
                <span className="text-white font-bold truncate">
                  {activePlaylist?.name}
                </span>
              </div>
            </div>

            {playlistTab === "browse" && (
              <>
                {/* Search and Filters */}
                <div className="space-y-3 sm:space-y-4 py-3 sm:py-4 border-b border-white/5">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSearchSubmit();
                    }}
                    className="relative flex items-center gap-2 bg-white/5 border border-white/5 focus-within:border-primary/50 rounded-xl sm:rounded-2xl p-1 transition-colors"
                  >
                    <Search className="text-gray-500 ml-2.5 sm:ml-3" size={15} />
                    <input
                      type="text"
                      placeholder="Search live TV..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={handleSearchKeyDown}
                      className="flex-1 bg-transparent border-none outline-none py-1.5 sm:py-2 px-2.5 sm:px-3 text-sm text-white placeholder:text-gray-500"
                    />
                    <button
                      type="submit"
                      className="rounded-xl bg-primary px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-white transition hover:bg-primary-dark"
                    >
                      Search
                    </button>
                  </form>

                  {/* Categories */}
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 max-h-[92px] overflow-y-auto pr-1 pb-1 custom-scrollbar">
                    {displayedCategories.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        title={cat}
                        className={`max-w-[210px] truncate px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold whitespace-nowrap border transition-all ${selectedCategory === cat
                            ? "bg-primary border-primary text-white shadow-lg shadow-primary/20"
                            : "bg-white/5 border-white/5 text-gray-400 hover:text-white hover:bg-white/10"
                          }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* List styled as a responsive grid */}
                <div
                  ref={channelListRef}
                  onScroll={handleChannelListScroll}
                  className="flex-1 min-h-0 overflow-y-auto pt-3 sm:pt-4 pr-1 custom-scrollbar"
                >
                  {loading || (isFifaCategory && fifaLoading) ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {Array.from({ length: 12 }).map((_, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2.5 sm:gap-3 p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-white/[0.02] border border-white/5 animate-pulse"
                        >
                          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-white/10" />
                          <div className="flex-1 space-y-1.5 sm:space-y-2">
                            <div className="h-2.5 sm:h-3 w-1/3 bg-white/10 rounded" />
                            <div className="h-3.5 sm:h-4 w-2/3 bg-white/10 rounded" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : filteredChannels.length === 0 ? (
                    <div className="text-center py-12 text-gray-500 text-sm font-medium">
                      No channels found match your filters.
                    </div>
                  ) : (
                    <div
                      className="relative"
                      style={{ height: virtualHeight }}
                    >
                      <div
                        className="absolute left-0 right-0 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3"
                        style={{ transform: `translateY(${virtualPaddingTop}px)` }}
                      >
                        {virtualChannels.map((chan) => {
                          const isSelected = selectedChannel?.id === chan.id;
                          const isFocused = focusedChannelId === chan.id;
                          return (
                            <button
                              key={chan.id}
                              onClick={() => handleChannelSelect(chan)}
                              className={`w-full h-[68px] flex items-center gap-2.5 sm:gap-3 p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border text-left transition-all group ${isSelected
                                  ? "bg-primary/10 border-primary text-primary"
                                  : isFocused
                                  ? "bg-white/[0.08] border-primary/60 ring-2 ring-primary/40 text-white"
                                  : "bg-white/[0.02] border-white/5 text-white hover:bg-white/[0.05] hover:border-white/10"
                                }`}
                            >
                              {chan.logo ? (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img
                                  src={chan.logo}
                                  alt={chan.name}
                                  width={40}
                                  height={40}
                                  loading="lazy"
                                  decoding="async"
                                  onError={(e) => {
                                    (e.target as HTMLElement).style.display = "none";
                                  }}
                                  className="w-9 h-9 sm:w-10 sm:h-10 object-contain rounded-lg sm:rounded-xl bg-white/5 p-0.5 border border-white/10 group-hover:scale-105 transition-transform flex-shrink-0"
                                />
                              ) : (
                                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-gradient-to-tr from-white/5 to-white/10 flex items-center justify-center font-bold text-xs border border-white/10 text-gray-400 group-hover:text-white transition-colors flex-shrink-0">
                                  {getInitials(chan.name)}
                                </div>
                              )}

                              <div className="flex-1 min-w-0">
                                <p
                                  className={`text-[10px] sm:text-xs font-bold uppercase tracking-wider truncate ${isSelected ? "text-primary/75" : "text-gray-500"
                                    }`}
                                >
                                  {chan.group}
                                </p>
                                <p className="text-[13px] sm:text-sm font-bold truncate">
                                  {chan.name}
                                </p>
                              </div>

                              {isSelected && (
                                <Play
                                  size={13}
                                  className="sm:w-3.5 sm:h-3.5 fill-primary text-primary animate-pulse flex-shrink-0"
                                />
                              )}
                            </button>
                          );
                        })}
                      </div>
                      {loadingMore && (
                        <div className="absolute left-0 right-0 bottom-0 flex justify-center py-3 text-xs font-bold text-gray-500">
                          Loading more channels...
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}

            {playlistTab === "sports" && (
              <div className="flex-1 overflow-y-auto pt-4 pr-1 custom-scrollbar text-left">
                <SportsHub
                  matches={footballMatches}
                  standings={footballStandings}
                  loading={footballInitialLoading}
                  lastUpdated={footballLastUpdated}
                  onTuneToChannel={handleTuneToChannelByName}
                />
              </div>
            )}

            {playlistTab === "manage" && (
              <div className="flex-1 overflow-y-auto pt-4 pr-1 space-y-6 custom-scrollbar text-left">
                {/* Import Playlist Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* URL Import Box */}
                  <form onSubmit={handleUrlImport} className="glass-card p-4 sm:p-5 border border-white/5 rounded-2xl bg-white/[0.01] flex flex-col justify-between min-h-[180px] hover:border-primary/20 transition-colors">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-primary/10 text-primary">
                          <Link size={18} />
                        </div>
                        <h4 className="font-bold text-sm sm:text-base">Load from URL</h4>
                      </div>

                      <div className="space-y-2">
                        <input
                          type="text"
                          placeholder="Playlist Name (e.g. My IPTV)"
                          value={playlistName}
                          onChange={(e) => setPlaylistName(e.target.value)}
                          className="w-full bg-white/5 border border-white/5 focus-within:border-primary/40 rounded-xl py-2.5 px-3 text-xs text-white placeholder:text-gray-500 outline-none transition-colors"
                        />
                        <input
                          type="url"
                          placeholder="https://example.com/playlist.m3u"
                          value={importUrl}
                          onChange={(e) => setImportUrl(e.target.value)}
                          required
                          className="w-full bg-white/5 border border-white/5 focus-within:border-primary/40 rounded-xl py-2.5 px-3 text-xs text-white placeholder:text-gray-500 outline-none transition-colors"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isImporting}
                      className="mt-4 w-full flex items-center justify-center gap-2 py-3 px-4 bg-primary hover:bg-primary/95 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-primary/10 disabled:opacity-50 active:scale-95 cursor-pointer"
                    >
                      {isImporting ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Importing Stream...</span>
                        </>
                      ) : (
                        <>
                          <Check size={14} />
                          <span>Import Playlist</span>
                        </>
                      )}
                    </button>
                  </form>

                  {/* File Upload Box */}
                  <div className="glass-card p-4 sm:p-5 border border-white/5 rounded-2xl bg-white/[0.01] flex flex-col justify-between min-h-[180px] hover:border-primary/20 transition-colors">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="p-2 rounded-lg bg-primary/10 text-primary">
                          <Upload size={18} />
                        </div>
                        <h4 className="font-bold text-sm sm:text-base">Upload Playlist File</h4>
                      </div>
                      <p className="text-xs text-gray-400">
                        Upload local .m3u, .m3u8, or .json playlist files. Stored securely in your browser cache.
                      </p>
                    </div>

                    <div className="mt-4">
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        accept=".m3u,.m3u8,.json"
                        className="hidden"
                      />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-white/5 hover:bg-white/10 text-white border border-white/10 hover:border-white/20 text-xs font-bold rounded-xl transition-all shadow-md active:scale-95"
                      >
                        <Upload size={14} />
                        <span>Choose M3U or JSON File</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Validation Errors */}
                {importError && (
                  <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold">
                    <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
                    <span>{importError}</span>
                  </div>
                )}

                {/* Saved Playlists */}
                <div className="space-y-3">
                  <h4 className="font-bold text-sm sm:text-base text-gray-300">Your Playlists</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {playlists.map((pl) => {
                      const isActive = pl.id === activePlaylistId;
                      return (
                        <div
                          key={pl.id}
                          onClick={() => {
                            setActivePlaylistId(pl.id);
                            setPlaylistTab("browse");
                          }}
                          className={`flex items-center justify-between p-4 sm:p-5 rounded-2xl border text-left transition-all cursor-pointer group/item ${isActive
                              ? "bg-primary/10 border-primary text-primary shadow-lg shadow-primary/5"
                              : "bg-white/[0.02] border-white/5 text-white hover:bg-white/[0.05] hover:border-white/10"
                            }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`p-2.5 rounded-xl border flex-shrink-0 ${isActive ? "bg-primary/20 border-primary/20" : "bg-white/5 border-white/10"
                              }`}>
                              {pl.type === "default" ? (
                                <Tv size={16} />
                              ) : pl.type === "url" ? (
                                <Link size={16} />
                              ) : (
                                <FileText size={16} />
                              )}
                            </div>

                            <div className="min-w-0">
                              <h5 className="font-bold text-xs sm:text-sm truncate pr-2">{pl.name}</h5>
                              <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">
                                {pl.channels.length} Channels • {pl.type === "default" ? "Built-in" : pl.type === "url" ? "URL" : "Uploaded File"}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {isActive && (
                              <span className="p-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                <Check size={12} className="stroke-[3]" />
                              </span>
                            )}
                            {pl.id !== "default" && (
                              <button
                                onClick={(e) => handleDeletePlaylist(pl.id, e)}
                                className="p-2 rounded-xl text-gray-400 hover:text-rose-500 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all opacity-0 group-hover/item:opacity-100 focus:opacity-100 cursor-pointer"
                                title="Delete Playlist"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 4. Footer with Developer Info */}
          <div className="w-full pt-4 md:pt-6 pb-2">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
              <div className="flex items-center gap-2">
                <p className="text-gray-500 text-[10px] sm:text-xs font-medium">
                  Enjoy your streaming experience! For any issues or suggestions, feel free to reach out via email or GitHub.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="flex items-center px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-[10px] sm:text-xs text-gray-400 font-medium whitespace-nowrap shadow-sm">
                  Developed by{" "}
                  <span className="text-white font-bold ml-1">Mitab Sany</span>
                </span>
                <a
                  href="https://mitabsany.netlify.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.08] hover:border-white/[0.18] text-[10px] sm:text-xs text-gray-300 hover:text-white font-semibold transition-all duration-300 shadow-sm whitespace-nowrap"
                >
                  <FaGlobe size={12} className="opacity-80" />
                  <span>Portfolio</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
