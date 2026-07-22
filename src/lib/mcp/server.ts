/**
 * 公開エッジの MCP サーバ（低レベル Server）。
 *
 * ツール定義（名前 / 説明 / 入力スキーマ）はマニフェスト（公開契約）から返し、
 * `tools/call` は dispatch でバックエンドへ委譲する。JSON Schema をそのまま扱いたいので
 * McpServer(Zod raw shape) ではなく低レベル Server + setRequestHandler を使う。
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js"

import { dispatchToolCall } from "@/lib/mcp/dispatch"
import { toolManifest } from "@/lib/mcp/manifest"

/**
 * 検証済み access token に束ねた MCP サーバを1リクエスト分生成する。
 * token はクロージャに閉じ込め、tools/call のたびに dispatch へ転送する。
 */
export function createEdgeMcpServer(accessToken: string): Server {
  const server = new Server(
    { name: "techhive-agent-mcp", version: "0.1.0" },
    { capabilities: { tools: {} } },
  )

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: toolManifest.tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  }))

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args } = req.params
    // 未知ツールもバックエンドに委譲せず、ここで弾く（公開契約に無いものは実行しない）。
    if (!toolManifest.tools.some((t) => t.name === name)) {
      return {
        content: [{ type: "text", text: `未知のツールです: ${name}` }],
        isError: true,
      }
    }
    return await dispatchToolCall({
      tool: name,
      args: (args ?? {}) as Record<string, unknown>,
      accessToken,
    })
  })

  return server
}
