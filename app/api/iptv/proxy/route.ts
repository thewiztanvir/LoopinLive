import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get("url");

  if (!targetUrl) {
    return NextResponse.json({ error: "Missing 'url' parameter" }, { status: 400 });
  }

  try {
    const response = await fetch(targetUrl);
    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch from target URL (Status ${response.status})` },
        { status: response.status }
      );
    }

    const contentType = response.headers.get("content-type") || "";
    const text = await response.text();

    return new Response(text, {
      status: 200,
      headers: {
        "Content-Type": contentType || "text/plain",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("Proxy error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch from target URL" },
      { status: 500 }
    );
  }
}
