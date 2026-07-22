import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "TechHive Agent MCP",
}

/**
 * 案内ページ（公開 repo の顔）。秘密や内部情報は一切出さない。
 * 実体の MCP は POST /mcp（OAuth 必須）。
 */
export default function Page() {
  return (
    <main
      style={{
        fontFamily: "system-ui, sans-serif",
        maxWidth: 720,
        margin: "0 auto",
        padding: "3rem 1.5rem",
        lineHeight: 1.7,
      }}
    >
      <h1 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>TechHive Agent MCP</h1>
      <p style={{ color: "#555" }}>
        TechHive Agents（FDE Agent MCP）の公開 MCP エンドポイントです。
      </p>
      <h2 style={{ fontSize: "1.05rem", marginTop: "2rem" }}>接続</h2>
      <pre style={{ background: "#f5f5f5", padding: "1rem", borderRadius: 8, overflowX: "auto" }}>
        <code>
          claude mcp add --transport http techhive-agent https://mcp.agents.techhive.bz/mcp
        </code>
      </pre>
      <p style={{ color: "#555", fontSize: "0.9rem" }}>
        初回接続時にブラウザで認証（ログイン + 組織 admin
        による同意）が求められます。トークンの手貼りは不要です。
      </p>

      <div
        style={{
          marginTop: "1.5rem",
          padding: "1rem 1.25rem",
          border: "1px solid #e5c07b",
          background: "#fdf6e3",
          borderRadius: 8,
          fontSize: "0.9rem",
          color: "#5c4813",
        }}
      >
        <strong>⚠️ 利用には TechHive Agents のアカウントが必要です</strong>
        <p style={{ margin: "0.5rem 0 0" }}>
          これは一般公開の API ではありません。認証を通せるのは、TechHive Agents
          の契約テナントに所属し、かつその組織の管理者（admin）権限を持つアカウントのみです。
          アカウントをお持ちでない場合、同意画面で権限エラーとなりツールは利用できません。
        </p>
      </div>
      <p style={{ color: "#888", fontSize: "0.85rem", marginTop: "2rem" }}>
        提案・不具合報告は GitHub Issues へ。承認された提案のみ社内トラッカーに取り込まれます。
      </p>
    </main>
  )
}
