/**
 * ツール実行の委譲。
 *
 * 公開エッジはビジネスロジックを持たない。検証済みの user Bearer と {tool, args} を、
 * 非公開バックエンド (agents.techhive.bz) の dispatch エンドポイントへ転送する。
 * apps 側が同じ Bearer を RLS-as-user で再検証し、既存ツールハンドラを実行して
 * MCP の CallToolResult を返す。秘密（service_role / Anthropic / 暗号鍵）は一切ここを通らない。
 */
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js"

import { getEnv } from "@/lib/env"

export type { CallToolResult }

export interface DispatchInput {
  tool: string
  args: Record<string, unknown>
  /** 検証済みの user OAuth アクセストークン（RLS-as-user 用に転送）。 */
  accessToken: string
}

/** dispatch へ POST し、apps が返した CallToolResult をそのまま返す。 */
export async function dispatchToolCall(input: DispatchInput): Promise<CallToolResult> {
  const env = getEnv()

  let res: Response
  try {
    res = await fetch(env.FDE_DISPATCH_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        // user 本人の RLS-as-user 権限
        authorization: `Bearer ${input.accessToken}`,
        // このエッジからの呼び出しであることの証明（apps 側で照合）
        "x-fde-dispatch-secret": env.FDE_DISPATCH_SECRET,
      },
      body: JSON.stringify({ tool: input.tool, args: input.args }),
    })
  } catch (err) {
    return errorResult(
      `dispatch へ到達できません: ${err instanceof Error ? err.message : String(err)}`,
    )
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "")
    return errorResult(`dispatch がエラーを返しました (${res.status}): ${body.slice(0, 500)}`)
  }

  try {
    return (await res.json()) as CallToolResult
  } catch {
    return errorResult("dispatch のレスポンスが不正な JSON です")
  }
}

function errorResult(message: string): CallToolResult {
  return { content: [{ type: "text", text: message }], isError: true }
}
