import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// In-memory cache
let cachedChannels: Array<{
  id: string;
  name: string;
  logo: string;
  group: string;
  url: string;
}> = [];
let lastLoadedTime = 0;

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

const regionKeywords = ["capital", "region", "north", "south", "east", "west"];

function getCategoryRank(category: string) {
  const popularIndex = POPULAR_CATEGORY_ORDER.indexOf(category);
  if (popularIndex !== -1) return popularIndex;

  const countryIndex = COUNTRY_CATEGORY_ORDER.indexOf(category);
  if (countryIndex !== -1) {
    return 100 + countryIndex;
  }

  const lowerCategory = category.toLowerCase();
  if (regionKeywords.some((keyword) => lowerCategory.includes(keyword))) {
    return 200;
  }

  if (category.includes(";")) {
    return 400;
  }

  return 300;
}

function sortCategories(categories: string[]) {
  return categories.sort((a, b) => {
    const rankDiff = getCategoryRank(a) - getCategoryRank(b);
    if (rankDiff !== 0) return rankDiff;

    return a.localeCompare(b);
  });
}

function getChannels() {
  const now = Date.now();

  // Refresh cache every 60 seconds
  if (now - lastLoadedTime > 60_000 || cachedChannels.length === 0) {
    try {
      const channelsPath = path.join(
        process.cwd(),
        "app/data/channels.json"
      );

      if (fs.existsSync(channelsPath)) {
        const raw = JSON.parse(fs.readFileSync(channelsPath, "utf8"));

        // Add IDs if not present and deduplicate
        cachedChannels = raw.map(
          (
            ch: { name: string; logo: string; group: string; url: string },
            idx: number
          ) => ({
            id: `ch-${idx}`,
            name: ch.name,
            logo: ch.logo || "",
            group: ch.group || "Uncategorized",
            url: ch.url,
          })
        );
        lastLoadedTime = now;
      }
    } catch (error) {
      console.error("Error reading IPTV channels file:", error);
    }
  }

  return cachedChannels;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(
    Math.max(Number(searchParams.get("limit")) || 80, 1),
    200
  );
  const offset = Math.max(Number(searchParams.get("offset")) || 0, 0);
  const search = (searchParams.get("search") || "").trim().toLowerCase();
  const category = (searchParams.get("category") || "All").trim();

  const channels = getChannels();
  const categories = sortCategories([
    "All",
    ...Array.from(new Set(channels.map((channel) => channel.group))),
  ]);
  const filteredChannels = channels.filter((channel) => {
    const matchesCategory = category === "All" || channel.group === category;
    const matchesSearch =
      !search || channel.name.toLowerCase().includes(search);

    return matchesCategory && matchesSearch;
  });
  const pagedChannels = filteredChannels.slice(offset, offset + limit);

  return NextResponse.json({
    channels: pagedChannels,
    total: filteredChannels.length,
    totalAvailable: channels.length,
    offset,
    limit,
    hasMore: offset + pagedChannels.length < filteredChannels.length,
    nextOffset: offset + pagedChannels.length,
    categories,
  }, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=60, stale-while-revalidate=120",
    },
  });
}
