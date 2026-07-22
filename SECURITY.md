# Security Policy

## 脆弱性の報告

セキュリティ上の問題を見つけた場合は、**公開 Issue を作らず**、非公開でご連絡ください。

- GitHub の **Private vulnerability reporting**（Security → Report a vulnerability）を利用してください。
- 悪用可能な詳細（PoC 等）は非公開のやり取りの中でのみ共有してください。

## このエッジの秘密の扱い

このリポジトリ（公開エッジ）は設計上、**秘密を保持しません**。

- 保持する環境変数は `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`（Supabase の公開値）、
  `FDE_DISPATCH_URL`、`FDE_DISPATCH_SECRET`（エッジ↔バックエンドの共有シークレット）のみ。
- `SUPABASE_SERVICE_ROLE_KEY` / `ANTHROPIC_API_KEY` / `CREDENTIAL_ENCRYPTION_KEY` 等は
  **非公開バックエンド (agents.techhive.bz) にのみ存在**し、このコードベース・デプロイには置きません。
- ユーザー認証は Supabase OAuth 2.1（per-user トークン）。トークンは repo にもエッジの永続ストレージにも保存しません。

## 機密・PII のコミット防止

`fde/draft/`（実クライアントデータ）や秘密ファイルの混入は三重で防いでいます:
`.gitignore` → `.githooks/pre-commit` → CI `secret-scan`（draft-guard + gitleaks）。
詳細は [CONTRIBUTING.md](./CONTRIBUTING.md#機密ガード三重) を参照。
