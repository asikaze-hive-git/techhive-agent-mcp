import type { NextConfig } from "next"

/**
 * techhive-agent-mcp — 公開 MCP エッジ。
 * MCP プロトコル終端 + OAuth リソースメタデータのみを配信し、ツール実行は
 * 非公開バックエンド (agents.techhive.bz) の dispatch エンドポイントへ委譲する。
 *
 * 秘密は一切ここに置かない (env は Supabase の公開値 + dispatch の URL/共有シークレットのみ)。
 */
const nextConfig: NextConfig = {
  // 攻撃面の縮小: このプロジェクトは MCP 専用ホスト。誤露出を避ける最小構成。
  poweredByHeader: false,
  reactStrictMode: true,
}

export default nextConfig
