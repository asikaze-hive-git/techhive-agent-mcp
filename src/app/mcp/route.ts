/**
 * 公開 FDE Agent MCP エンドポイント — Streamable HTTP（OAuth 2.1）。
 *
 * `claude mcp add --transport http techhive-agent https://mcp.agents.techhive.bz/mcp` で接続。
 * Supabase OAuth 2.1（DCR/PKCE）でブラウザ認証 → user アクセストークンで本エンドポイントを叩く。
 *
 * ここは「MCP プロトコル終端 + トークン軽検証 + ツール実行の委譲」だけを行う公開エッジ。
 * 実際のツール実装・秘密・runner は非公開バックエンド (apps) に据え置き、dispatch 経由で実行する。
 */
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js"

import { createEdgeMcpServer } from "@/lib/mcp/server"
import { verifyOAuthToken } from "@/lib/oauth/verify"

export const runtime = "nodejs"

/** 未認証時に protected-resource メタデータ位置を示す（MCP クライアントの discovery 用）。 */
/**
 * リクエストの origin から protected-resource メタデータの位置を組み立てる。
 *
 * ハードコードにしない理由: クライアントは 401 のこのポインタを辿って「いま喋っている
 * resource」の認可サーバを発見する。固定ドメインを返すと、*.vercel.app や preview から
 * 叩いたときに「接続先」と「認証対象の resource」が食い違い、OAuth が噛み合わない。
 * origin 由来なら discovery が返す `resource` と常に一致し、ドメイン付け替え後も自動追従する。
 */
const PROTECTED_RESOURCE_PATH = "/.well-known/oauth-protected-resource"

function wwwAuthenticate(req: Request): string {
  const origin = new URL(req.url).origin
  return `Bearer resource_metadata="${origin}${PROTECTED_RESOURCE_PATH}"`
}

function unauthorized(req: Request, message: string) {
  return Response.json(
    { jsonrpc: "2.0", error: { code: -32001, message: `Unauthorized: ${message}` }, id: null },
    { status: 401, headers: { "WWW-Authenticate": wwwAuthenticate(req) } },
  )
}

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization")
  if (!authHeader?.startsWith("Bearer ")) {
    return unauthorized(req, "Bearer token required")
  }
  const token = authHeader.slice(7)

  try {
    // 軽検証（401 を正しく返すため）。認可の正本は dispatch 側の RLS-as-user 再評価。
    await verifyOAuthToken(token)
  } catch (err) {
    return unauthorized(req, err instanceof Error ? err.message : "token verification failed")
  }

  const server = createEdgeMcpServer(token)
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined })
  await server.connect(transport)
  return await transport.handleRequest(req)
}

// GET / DELETE は 405。stateless transport（sessionIdGenerator: undefined）はサーバー起点の
// standalone SSE ストリームを持たないため Method Not Allowed を返す（apps 側と同一挙動。
// 200+静的JSON を返すと Claude Code が SSE 確立→即クローズ→即再接続の暴走ループを起こす）。
function methodNotAllowed() {
  return Response.json(
    { jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed." }, id: null },
    { status: 405, headers: { Allow: "POST" } },
  )
}

export function GET() {
  return methodNotAllowed()
}

export function DELETE() {
  return methodNotAllowed()
}
