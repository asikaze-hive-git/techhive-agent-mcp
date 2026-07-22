---
name: author-persona
description: TechHive のペルソナ草案（persona.json）を作るためのガイド。fde/draft ディレクトリの構成、persona.json のスキーマ、system_prompt に集約する横断ルール、skills_blueprint にチェイン先まで全部入れる注意を定義する。ペルソナを作る前に読む。
---

# ペルソナ草案の作り方

## 1. ドラフトのディレクトリ構成

ペルソナ 1 体は `fde/draft/<persona_id>/` にまとめる:

```
fde/draft/<persona_id>/
├── persona.json                       ← ペルソナ定義（下記スキーマ）
└── skills/
    ├── <skill_id_a>/
    │   ├── SKILL.md                    ← author-skill 規約に従う
    │   └── refs/                       ← 任意。子（参照ファイル）
    │       ├── something.py
    │       └── schema.yaml
    └── <skill_id_b>/
        └── SKILL.md
```

- `<persona_id>` / `<skill_id>` は `[a-z0-9-]`。
- `refs/` のファイルは子レコード（`reference_script` / `reference_schema` 等）として登録される。拡張子で型を推定（`.py`→script / `.yaml`/`.yml`→schema / `.md`→doc / その他→template）。

## 2. persona.json スキーマ

```json
{
  "personaId": "recruiting-example",
  "displayName": "採用担当（Example社）",
  "role": "Airワーク採用担当",
  "avatarPath": "/placeholders/avatars/avatar-03.svg",
  "mode": "orchestrator",
  "model": "claude-sonnet-4-6",
  "systemPrompt": "<横断ルールを集約。§3 参照>",
  "skillsBlueprint": [
    "application-intake",
    "duplicate-check",
    "resume-screening"
  ],
  "skills": [
    { "skillId": "application-intake", "displayOrder": 1 },
    { "skillId": "duplicate-check", "displayOrder": 2 },
    { "skillId": "resume-screening", "displayOrder": 3 }
  ],
  "triggers": [
    { "type": "webhook", "source": "example-ats", "event": "applicant.created" },
    { "type": "cron", "schedule": "0 9 * * 1-5" },
    { "type": "manual" }
  ],
  "config": {
    "hitl_tier_threshold": 3,
    "spreadsheet_id": "<外部: Google Sheets ID>",
    "slack_channel_id": "<外部: Slack channel>"
  },
  "notifications": [
    { "type": "slack", "enabled": true, "config": { "slack_channel_id": "<外部>" } }
  ],
  "notes": null,
  "department": null
}
```

| フィールド | 必須 | メモ |
|---|---|---|
| `personaId` | ✅ | `[a-z0-9-]`。既存と被ると upsert で上書き更新になる |
| `displayName` / `role` / `avatarPath` | 推奨 | UI 表示 |
| `mode` | ✅ | `orchestrator`（専門・自律ループ）/ `generalist`（汎用・UI チャット） |
| `model` | ✅ | 例 `claude-sonnet-4-6` |
| `systemPrompt` | ✅ | 横断ルールを集約（§3）。orchestrator は必須 |
| `skillsBlueprint` | ✅ | attach する skill_id の whitelist。**チェイン先も全部入れる**（§4） |
| `triggers` | ✅（orchestrator） | **自動生成されない**（業務固有）。`webhook`/`cron`/`email_pubsub`/`manual` のいずれか ≥1。空だと自律発火しない（§5） |
| `config` | 推奨 | `hitl_tier_threshold`（未指定なら upsert 時に **既定 3** が補完される）＋ 外部値（spreadsheet_id / slack_channel_id 等） |
| `skills` | 任意 | `ペルソナのスキル構成` 結線の明示。省略時は `skillsBlueprint` の順で自動生成 |
| `notifications` | 推奨 | Slack 通知。`slack_channel_id` は外部値（§6） |
| `notes` / `department` | 任意 | メモ / 部署 |

### upsert 時に自動補完される（persona.json に書かなくてよい）

以下は **upsert 時に正しい定型が補完される**（FDE MCP の persona_upsert / deploy 側）。書けば上書きされる。

| 自動生成 | 既定値 |
|---|---|
| `agent_meta` | `name`=personaId / `description`=role / `tools`=`agent_toolset_20260401`＋`mcp_toolset(techhive, always_allow)` / `metadata` |
| `environment_config` | `{name:"<personaId>-env", config:{type:"cloud", packages:{npm:["playwright"]}, networking:{type:"unrestricted"}}}` |
| `policy` | `{actionType:"auto"}` |
| `case_config`（orchestrator） | `{caseType:personaId, maxCycles:50}` |
| `config.hitl_tier_threshold` | `3`（Tier3+ は承認必須） |

> `enabled` / `managed_agent_id` / `managed_agent_version` / `environment_id` / `needs_redeploy` / `deployed_at` / `prompt_version` も **書かない**（スクリプト管理、新規は `enabled=false`）。

## 3. system_prompt に集約する横断ルール（SKILL.md には書かない）

各 SKILL.md に重複させず、ここに一元化する:

- 活動ログ・セッションステータス・Slack 通知は**手で書かない**（完了時に自動記録される）。
- **idle に入ってよいのは 4 分岐だけ**: (a) フロー完了 (b) 応募者返信待ち (c) 人間判断待ち (d) 続行不能エラー。
- 割り当てられたフローは**同一セッション内で最後まで実行しきる**（途中 idle 禁止／「あとで自動で続く」仕組みは無い）。
- ペルソナの人格・口調・対人方針・会社固有の前提。

## 4. skills_blueprint はチェイン先まで全部入れる（重要）

`skills_blueprint` は attach する whitelist。**エントリ点のスキルだけ入れると、in-session でチェインする後続スキルが attach されず実行が途中で止まる**（過去に intake→duplicate-check が attach 漏れで停止）。

→ SKILL.md の `<workflow>` 末尾で「次に `X` を実行する」と書いたら、その `X` も必ず `skillsBlueprint` に入れる。`skills:` frontmatter で依存しているスキル（adapter 等）も入れる。

## 5. triggers（orchestrator は必須・自動生成されない）

`triggers` は「ペルソナがどう発火するか」。業務固有なので **FDE が指定する**（空だと manual 以外で自律発火しない）。型:

| type | 形 | 用途 |
|---|---|---|
| `webhook` | `{type:"webhook", source, event}` | 外部 webhook（source/event 両方一致で発火） |
| `email_pubsub` | `{type:"email_pubsub", source, match:{senders[], subjectKeywords[]}}` | 受信メール（from＋subject の AND） |
| `cron` | `{type:"cron", schedule}` | 定期。⚠️ **別途 `cron 設定` 行が必要**（cron 発火は DB 側マッピングが要る。無ければ開発陣営にイシュー） |
| `manual` | `{type:"manual"}` | UI/手動起動 |

## 6. 外部プロビジョニング値（ドラフトでは発明できない）

`slack_channel_id` / `slack_owner_uid` / `spreadsheet_id` / シート GID / `rpa_units[].connectionId`（認証）/ `organizations.settings.slack_team_id` などは**現実の ID/資格情報**。FDE は **DB ドラフト作成まで**を行い、これらは:

- 既存の値があれば persona.json の `config` / `notifications` に入れる。
- **必要なカスタムツール/連携がまだ無いなら、開発陣営にイシューを作成**して実装してもらう（FDE はドラフトを作るところまでで OK）。
- validate では足りなくても **warn 止まり**（ドラフトは作れる）。本番稼働前に人が埋める。

## 7. 仕上げたら検証

FDE MCP の `bundle_validate` ツールで検証する（スクリプト版は廃止予定）。
登録・デプロイは FDE MCP の `skill_upsert → persona_upsert → deploy` フロー（旧 register-to-db スキル＝scripts 経路は廃止済み。DB 直書きは hook が拒否する）。
