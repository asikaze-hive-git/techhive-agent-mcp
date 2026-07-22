# Contributing — techhive-agent-mcp

このリポジトリは TechHive Agents（FDE Agent MCP）の**公開エッジ**であり、同時に**提案窓口**として運営しています。

## この repo の役割

- **提案窓口**: 誰でも Issue で不具合報告・ツール提案・接続相談ができます。
- 実装の本体（proprietary なツールロジック・秘密・実行基盤）は**非公開の社内トラッカー / コードベース**にあります。この repo には含まれません。

## 提案の流れ（Anthropic / freee スタイル）

```
あなた: Issue Form で起票（bug / tool proposal / connection help）
   │
メンテナ: 精査（triage）
   ├─ 採用 → `accepted` ラベル → GitHub Actions が社内トラッカーに自動ミラー起票
   │         元 Issue にバックリンクをコメントし `mirrored` を付与（以降は社内で管理）
   └─ 見送り → `declined` ラベル + 理由コメント
```

- 取り込みは**片方向**です。社内トラッカーの詳細な進捗・議論はこの公開 repo には流しません（機密保護のため）。
- 採用の可否・優先度はメンテナが判断します。すべての提案が実装されるとは限りません。

### ラベル

| ラベル | 意味 |
|:---|:---|
| `triage` | 初期状態（未精査） |
| `accepted` | 採用。社内トラッカーへ自動ミラー |
| `declined` | 見送り |
| `mirrored` | 社内トラッカーへ取り込み済み |

## 🚫 絶対に書かないこと（公開 repo です）

- トークン / API キー / 認可コード / パスワード
- 顧客名・担当者名・メールアドレス等の**個人情報 / クライアント機密**
- 認可 URL のクエリ文字列（コードが載ることがある）

Issue Form には秘密を含めていないことのチェックがあります。

## コード変更（PR）

このエッジのコードに対する PR も歓迎します。手元で品質ゲートを通してください:

```bash
pnpm install     # prepare で pre-commit フック(core.hooksPath)が自動有効化されます
pnpm ci:local    # biome + tsc --noEmit + next build
```

### 機密ガード（三重）

`fde/draft/`（FDE の作業用・実クライアントデータ）は**絶対にコミットしません**。以下で構造的に防いでいます:

1. `.gitignore` / `fde/.gitignore` — `fde/draft/**` と `*.xlsx` / `*.sa.json` / `.env*` を除外
2. `.githooks/pre-commit` — `git add -f` で貫通しようとしても commit を中止（`pnpm install` で自動有効化）
3. CI `secret-scan`（draft-guard + gitleaks）— 追跡ファイルや秘密文字列があれば PR を fail
