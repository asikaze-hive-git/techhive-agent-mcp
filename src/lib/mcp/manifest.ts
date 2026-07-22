/**
 * ツールマニフェスト（公開契約）。
 *
 * 実装は apps 側に据え置き、公開エッジは「ツールの名前 / 説明 / 入力スキーマ（JSON Schema）」
 * だけを持つ。この JSON は apps の権威レジストリから `pnpm generate:manifest` で再生成し
 * commit するスナップショット（freee-mcp の generate:references と同じ発想）。
 *
 * ⚠️ Phase 1 時点では下記はプレースホルダ。Phase 2 で apps の
 * `/api/internal/fde/manifest` から実際の 43 ツールを流し込む。
 */
import manifestJson from "../../../tools-manifest.json" with { type: "json" }

export interface ManifestTool {
  name: string
  description: string
  /** MCP `tools/list` がそのまま返す JSON Schema（object 型）。 */
  inputSchema: Record<string, unknown>
}

export interface ToolManifest {
  /** apps 側レジストリのスナップショット時刻（ISO）。ドリフト検知の目印。 */
  generatedAt: string
  /** apps 側 createFdeMcpServer の version。 */
  sourceVersion: string
  tools: ManifestTool[]
}

export const toolManifest = manifestJson as ToolManifest
