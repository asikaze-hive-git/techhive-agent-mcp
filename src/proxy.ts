import { type NextRequest, NextResponse } from "next/server"

/**
 * Vercel Routing Middleware (Next.js 16: middleware.ts → proxy.ts)。
 *
 * このプロジェクトは MCP 専用ホスト (mcp.agents.techhive.bz) にのみ割り当てる。
 * 攻撃面を最小化するため、通すのは次の2つだけ:
 *   - `/mcp`（MCP エンドポイント本体）
 *   - `/.well-known/oauth-protected-resource`（discovery。API ルートへ rewrite）
 * それ以外は 404。cookie セッションは扱わない（Bearer/OAuth のみ）。
 */
const PROTECTED_RESOURCE_PATH = "/.well-known/oauth-protected-resource"

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname === PROTECTED_RESOURCE_PATH) {
    return NextResponse.rewrite(new URL("/api/well-known/oauth-protected-resource", request.url))
  }
  if (pathname === "/mcp" || pathname.startsWith("/mcp/")) {
    return NextResponse.next()
  }
  // ルート（/）だけは案内ページを許可（公開 repo の顔）。
  if (pathname === "/") {
    return NextResponse.next()
  }
  return new NextResponse("Not Found", { status: 404 })
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
