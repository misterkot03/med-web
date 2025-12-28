import type { NextRequest } from "next/server";

const UPSTREAM = process.env.NEXT_PUBLIC_API_BASE ?? "http://62.84.116.147:8001";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

async function forward(
  req: NextRequest,
  ctx: { params: Promise<{ path?: string[] }> }
) {
  // В Next 15 params — асинхронные.
  const { path = [] } = await ctx.params;

  // Разрешаем необязательный первый сегмент "cmp"
  const pathTail = path[0] === "cmp" ? path.slice(1) : path;
  const tail = "/" + pathTail.join("/");

  const urlObj = new URL(req.url);
  const qs = urlObj.search;

  const target = `${UPSTREAM}${tail}${qs}`;

  const init: RequestInit = {
    method: req.method,
    headers: {
      "Content-Type": req.headers.get("content-type") ?? "application/json",
      Authorization: req.headers.get("authorization") ?? "",
    },
    redirect: "follow",
  };

  if (["POST", "PUT", "PATCH"].includes(req.method)) {
    init.body = await req.text();
  }

  const r = await fetch(target, init);
  const body = await r.text();

  return new Response(body, {
    status: r.status,
    headers: {
      "Content-Type": r.headers.get("content-type") ?? "application/json",
      ...corsHeaders(),
    },
  });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  return forward(req, ctx);
}
export async function POST(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  return forward(req, ctx);
}
export async function PUT(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  return forward(req, ctx);
}
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  return forward(req, ctx);
}
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  return forward(req, ctx);
}
