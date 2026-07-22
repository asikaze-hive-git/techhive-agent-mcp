# CLAUDE.md — techhive-agent-mcp（公開 MCP エッジ）

> このリポジトリは **公開エッジ**。MCP プロトコル終端 + OAuth + ツールスキーマ提示だけを担い、
> ツール実行は非公開バックエンド (`agents.techhive.bz`) の dispatch へ委譲する。
> **proprietary コード・秘密・runner はここに置かない。**

## 絶対ルール

1. **秘密を絶対にコミットしない。** 環境変数は `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`（公開値）、
   `FDE_DISPATCH_URL` / `FDE_DISPATCH_SECRET` のみ。`SERVICE_ROLE` / `ANTHROPIC_API_KEY` / `CREDENTIAL_ENCRYPTION_KEY` は
   非公開バックエンド側にのみ存在する。ここに足そうとしたら設計違反。
2. **ビジネスロジックを持ち込まない。** ツールの実装は apps 側の唯一の実装を dispatch 経由で呼ぶ。ここで DB を直接書かない。
   （将来の最適化として、純読み取りツールのみ Supabase 直読み RLS-as-user に短絡する余地はあるが、既定は委譲。）
3. **`fde/draft/` を push しない。** 実クライアントの機密・PII が入る。`.gitignore` + pre-commit + CI(gitleaks) の三重ガード。
4. **`pnpm ci:local` を push 前に通す。** `biome check .` + `tsc --noEmit` + `next build`。

## アーキテクチャ（thin-proxy MCP）

```
Claude ──OAuth2.1(Supabase, DCR/PKCE)──▶ /mcp (route.ts)
                                           │ verifyOAuthToken (JWKS 軽検証)
                                           │ createEdgeMcpServer(token)
                                           │   - tools/list → tools-manifest.json
                                           │   - tools/call → dispatchToolCall(...)
                                           ▼
                        POST FDE_DISPATCH_URL (+ Bearer, + x-fde-dispatch-secret)
                                           ▼
                        apps: /api/internal/fde/dispatch（Bearer 再検証 + 既存ハンドラ実行）
```

## ツールマニフェストの更新

`tools-manifest.json` は apps の権威レジストリのスナップショット（公開契約）。
apps 側でツールの追加・スキーマ変更をしたら:

```bash
FDE_MANIFEST_URL=https://agents.techhive.bz/api/internal/fde/manifest \
FDE_DISPATCH_SECRET=... \
pnpm generate:manifest
```

で再生成して commit する（freee-mcp の `generate:references` と同じ運用）。

## 関連

- 上流の設計 SoT: 非公開の社内 monorepo 側の設計書（`docs/revision-v4/` 配下）
- 提案窓口の運用: [CONTRIBUTING.md](./CONTRIBUTING.md)
