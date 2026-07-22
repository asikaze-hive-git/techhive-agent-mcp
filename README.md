# techhive-agent-mcp

**TechHive Agents（FDE Agent MCP）の公開 MCP サーバ・エッジ。**

FDE（Forward Deployed Engineer）がローカルの Claude から、クライアント専用エージェントの
スキル執筆・ペルソナ組成・配線・デプロイ・稼働後改善までを実行するための MCP エンドポイントです。

```
claude mcp add --transport http techhive-agent https://mcp.agents.techhive.bz/mcp
```

初回接続時にブラウザで認証（ログイン + 組織 admin による同意）が求められます。トークンの手貼りは不要です（OAuth 2.1 / DCR / PKCE）。

> ### ⚠️ 利用には TechHive Agents のアカウントが必要です
>
> **これは一般公開の API ではありません。** 誰でも接続を試すことはできますが、**認証を通せるのは
> TechHive Agents の契約テナントに所属し、かつその組織の管理者（admin）権限を持つアカウントだけ**です。
>
> - アカウントをお持ちでない場合、同意画面で権限エラーとなり、ツールは一切利用できません
> - アカウントの発行・テナントの契約については TechHive Agents までお問い合わせください
> - このリポジトリのソースは公開していますが、**ツールの実行はすべて非公開バックエンドで認可・実行**されます
>   （このリポジトリを自前でデプロイしても、バックエンドの認可を通らなければ何も実行できません）

---

## これは何か（アーキテクチャ）

このリポジトリは **公開エッジ**です。MCP プロトコルの終端・OAuth リソースメタデータの配信・
ツールスキーマ（公開契約）の提示だけを行い、**ツールの実行は非公開バックエンドへ委譲**します。
proprietary なビジネスロジック・秘密（暗号鍵 / API キー / service_role）・実行基盤は
一切このリポジトリには含まれません。

```
ローカル Claude ──OAuth2.1──▶ mcp.agents.techhive.bz  (このリポジトリ / 公開エッジ)
                                 │  MCP 終端 + トークン軽検証 + ツールスキーマ提示
                                 │  tools/call = {name, args} + Bearer を転送
                                 ▼
              agents.techhive.bz/api/internal/fde/dispatch  (非公開バックエンド)
                                 │  同じ Bearer を RLS-as-user で再検証し実行
                                 ▼
              実装 / 秘密 / runner / DB（すべて非公開側に据え置き）
```

この構成は freee 社の [freee-mcp](https://github.com/freee/freee-mcp) と同型です（公開 MCP + per-user OAuth + repo に秘密ゼロ）。
唯一の違いは、freee のバックエンドが公開 REST API なのに対し、こちらは自社の非公開 dispatch を叩く点です。

## リポジトリ構成

| パス | 役割 |
|:---|:---|
| `src/app/mcp/route.ts` | MCP エンドポイント（OAuth 軽検証 → dispatch 委譲） |
| `src/app/api/well-known/oauth-protected-resource/route.ts` | OAuth 2.0 Protected Resource Metadata (RFC 9728) |
| `src/proxy.ts` | Host ゲート（`/mcp` と discovery 以外は 404） |
| `src/lib/mcp/server.ts` | 低レベル MCP Server（マニフェストから tools/list、tools/call は委譲） |
| `src/lib/mcp/dispatch.ts` | 非公開 dispatch への転送 |
| `src/lib/oauth/verify.ts` | Supabase OAuth トークンの JWKS 検証 |
| `tools-manifest.json` | ツールの公開契約（名前 / 説明 / 入力スキーマ）。`pnpm generate:manifest` で再生成 |
| `fde/` | FDE 作業フォルダ（テンプレ + スキル）。`fde/draft/` は機密のため git 追跡外 |

## 開発

```bash
pnpm install
cp .env.example .env.local   # 値を設定（すべて非秘密 + 共有シークレット1つ）
pnpm dev
pnpm ci:local                # lint + typecheck + build（品質ゲート）
```

環境変数（`.env.example` 参照）: `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`（公開値）、
`FDE_DISPATCH_URL` / `FDE_DISPATCH_SECRET`（dispatch 委譲用）。
**SERVICE_ROLE / ANTHROPIC_API_KEY / CREDENTIAL_ENCRYPTION_KEY は絶対に置きません。**

## 提案・不具合報告

このリポジトリは**提案窓口**として運営しています。誰でも Issue を起票できます。
メンテナが精査し、承認された提案のみ社内トラッカーに取り込みます（片方向）。詳細は [CONTRIBUTING.md](./CONTRIBUTING.md)。
