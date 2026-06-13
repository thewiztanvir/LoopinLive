import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

interface FifaChannelRaw {
  name: string;
  logo: string;
  group: string;
  url: string;
  type?: string;
  kid?: string;
  key?: string;
}

export async function GET() {
  try {
    const fifaPath = path.join(process.cwd(), "app/data/fifa.json");

    if (!fs.existsSync(fifaPath)) {
      return NextResponse.json(
        { channels: [], total: 0, categories: ["FIFA World Cup"] },
        { status: 200 }
      );
    }

    const raw: FifaChannelRaw[] = JSON.parse(
      fs.readFileSync(fifaPath, "utf8")
    );

    const channels = raw.map((ch, idx) => ({
      id: `fifa-${idx}`,
      name: ch.name,
      logo: ch.logo || "",
      group: "FIFA World Cup",
      url: ch.url,
    }));

    return NextResponse.json(
      {
        channels,
        total: channels.length,
        categories: ["FIFA World Cup"],
      },
      {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (error) {
    console.error("Error reading FIFA channels file:", error);
    return NextResponse.json(
      { channels: [], total: 0, categories: ["FIFA World Cup"] },
      { status: 500 }
    );
  }
}
