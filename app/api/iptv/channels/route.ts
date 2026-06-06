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

export async function GET() {
  const channels = getChannels();

  return NextResponse.json(channels, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=60, stale-while-revalidate=120",
    },
  });
}
