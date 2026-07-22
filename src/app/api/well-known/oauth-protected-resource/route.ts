/**
 * OAuth 2.0 Protected Resource Metadata (RFC 9728)。
 *
 * MCP クライアント（Claude 等）が `https://mcp.agents.techhive.bz/mcp` への 401 を受け、
 * `/.well-known/oauth-protected-resource` を参照して認可サーバ(Supabase)を発見する。
 * middleware(proxy.ts) が `/.well-known/...` からここへ rewrite する
 * （Next.js の dot-folder ルーティングを避けるため）。
 * apps 側の同名ルートと同一の内容を返す。
 */
import { getEnv } from "@/lib/env"

export const runtime = "nodejs"

export function GET(req: Request) {
  const origin = new URL(req.url).origin
  const { NEXT_PUBLIC_SUPABASE_URL } = getEnv()

  return Response.json(
    {
      resource: `${origin}/mcp`,
      // Supabase OAuth 2.1 Server の issuer。クライアントはここから AS メタデータを発見する。
      authorization_servers: [`${NEXT_PUBLIC_SUPABASE_URL}/auth/v1`],
      bearer_methods_supported: ["header"],
    },
    { headers: { "Cache-Control": "public, max-age=3600" } },
  )
}
