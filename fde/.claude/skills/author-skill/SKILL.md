---
name: author-skill
description: TechHive の SKILL.md を Anthropic 推奨スタイルで執筆するための規約ガイド。手順/判定系と参照系の書き分け、XMLタグ構造、custom_toolフェンス、Rules層分離、frontmatter、cruft除去を定義する。新しいスキルを書く前に必ず読む。
---

# SKILL.md オーサリング規約（Anthropic 推奨スタイル）

> SoT は `スキル台帳.content.body`（DB）。`apps/src/skills/**` のファイルは参照しない。
> 実例（golden reference）は**社内の作業環境にのみ配置**している。最も近い種別を開いて構造を真似ること。

## 0. 大原則

- **対象は自律実行ペルソナ Agent**。一般チャットより「手順の明示性」「失敗時の振る舞い」「判定順序の固定」が重要。
- スキルは 2 系統で扱いを変える:
  - **手順/判定系**（agent が読んで実行する `persona_specific` スキル）→ 下記 XMLタグ・テンプレートをフル適用。
  - **参照系 / system / cron / adapter**（agent が手順として読まない内部スキル）→ テンプレートを当てはめず **light-touch**（cruft 除去 + 体裁整理 + description 整備のみ、ロジック温存）。

## 1. ボディ構造（XMLタグセクション）

手順/判定系スキルは、本文をこの順のタグセクションで構成する:

```
frontmatter
<role>            … 何者で、どこにチェインされる担当か（1〜3行）
<constraints>     … スキル固有の境界（横断ルールは書かない）
<inputs>          … 前スキルから受け取る引き継ぎコンテキスト
<workflow>        … 番号付き Step。各 Step に「完了条件」を必ず付ける
<decision_rules>  … 思考順序を固定（判定系スキルのみ）
<examples>        … <example index="N"> を 3〜5 個（判定系スキルのみ）
<output_format>   … 後段が機械解析する agent message / 出力の型を固定
<error_handling>  … 失敗時の挙動を表で
```

- **判定系（分岐・合否判定を持つ）だけ** `<decision_rules>` + `<examples>` を付ける。単機能スキルには付けない（冗長回避）。
- `<reminders>` は任意（事故防止の最重要事項を末尾に集約したいとき）。

### タグの書式ルール（プレビュー描画の前提・厳守）

UI プレビューはタグを「HTML要素」ではなく「セクション境界」として行ベースで分割する。そのため:

- **開きタグ `<tag>` / 閉じタグ `</tag>` は、それぞれ行頭に単独で置く**（`<role>こんにちは</role>` のような 1 行形式は不可）。
- タグ内側は**空行で挟む**（中身を Markdown として描画させるため）。
- `<examples>` の中に `<example index="1">` … `</example>` をネスト（1 段のみ）。
- コードフェンス（```）内の `<...>` は境界扱いされない（誤検出しない）。

## 2. カスタムツール記法（必須・統一）

THA の MCP エンドポイントを叩く呼び出しは、ただのコードブロックにせず**専用フェンス**にする（UI がカード表記へ特殊処理する）:

    ```custom_tool toolName="<tool-name>"
    { ...入力 JSON ... }
    ```

- 対象: `credential_get` / `recruiting_job_lookup` / `gsheet_insert` / `gsheet_read_range` / `gsheet_append_row` / `persona_config_get` / `session_context_get` / `raise_supervisor_alert` など MCP カスタムツール全般。
- 対象外: `bash`（```bash のまま）、説明用 JS スニペット（```js / ``` のまま）。
- MCP tool 名は**無修飾**でよい（単一 techhive MCP 構成で正常解決される）。
- toolName は登録済みツールでなければならない（`validate-draft.ts` が registry 照合する）。

## 3. Rules 層との分離（横断ルールは system_prompt へ）

横断ルールは persona `system_prompt`（常時ロード）に一元化し、**各 SKILL.md に重複させない**:

- 「活動ログ・セッションステータス・Slack 通知は手で書かない（完了時に自動記録）」
- 「idle に入ってよいのは (a) フロー完了 (b) 応募者返信待ち (c) 人間判断待ち (d) 続行不能エラー の 4 分岐だけ」
- 「割り当てられたフローを同一セッション内で最後まで実行しきる／途中 idle 禁止／『あとで自動で続く』仕組みは無い」

各 SKILL の `<constraints>` には **そのスキル固有のことだけ**残す: 次にチェインするスキル名 / 委譲先 / このスキル固有の idle 分岐（上記 a〜d の具体例）。

> ⚠️ この分離は事故対策そのもの。description や本文に「idle 後に新パイプラインが自動で…」と書くと、小型モデル（haiku 等）が「スキル実行自体が自動でスキップされる」と誤読して途中 idle する（実障害の原因）。

## 4. frontmatter ルール（公式仕様準拠）

- `name`: **現 skill_id を変えない**（blueprint・チェイン・課金 RPC・DB が参照する識別キー）。≤64字・英小文字/数字/ハイフン・`anthropic`/`claude` 不可。
- `description`: **最大 1024 字（実質 ~150 字目標）/ 三人称 / XMLタグ禁止 / 「何をする＋いつ起動」**。イシュー番号や裏側解説を入れない。全スキル分が起動時に常時システムプロンプトへ常駐するので短く。
- **`bfc_id`（必須・THA/原価の基盤）**: そのスキルが属する業務単位（BFC L3 コード、例 `"1.3.2"`）。**THA トークン計算・原価計算がすべて bfc_id を基盤とする**ため必須。
  - **業務スキル** → 対応する L3 コードを **FDE に必ず聞く**（`BFC カタログ` に active で実在する値）。null だと課金集計から永久に漏れる（業務台帳 は append-only で遡及不可）。
  - **非課金 infra**（adapter / スキーマ / dispatch 等）→ `"-"`。
  - validate が `BFC カタログ` 実在＆active を機械チェックする。誤コードはブロック。
- `tools` / `skills` / `references`: **実使用に合わせて記載**（このスキル内で実際に使う custom_tool と、in-session でチェインする後続スキルのみ）。自動生成されない — 過不足なく自分で書く。
- 本文（body）は **500 行以内**（超えるなら参照ファイルに分割）。

## 5. cruft（必ず削る無駄文言）

- イシュー/PR番号（`#185` / `#205` 等）
- 「新パイプライン / idle 駆動 webhook が自動記録する」等の**裏側パイプライン解説**
- `bfc x.x.x` / `NN THA` 等の**課金内部値**
- 「担当者ヒアリング YYYY-MM-DD」「2026-05-11 復旧記録」等の**日付引用**（ルール本文は残し、引用・経緯ナレーションだけ消す）
- 「旧〜は廃止 / 撤去対象 / かつて / 以前は / 別 issue 予定」等の**履歴・経緯**
- 到達不能と明記された**デッドパス節**
- ツールラッパー残骸（`</content>` `</invoke>` 等。サブエージェント生成時に紛れ込むので末尾を必ず確認）

**温存するもの**: 業務手順・判定基準・列マッピング・閾値・文面テンプレ・スクリプト名と入出力。cruft 以外は 1 つも削らない。

## 6. 各セクションの中身ガイド

| タグ | 入れる内容 |
|---|---|
| `<role>` | 「あなたは○○担当として△△する」。前提スキル・チェイン位置。 |
| `<constraints>` | 完走範囲 / idle 分岐 / 委譲先・やらないこと（スキル固有のみ） |
| `<inputs>` | 前スキルから受け取る値の一覧。`session_context_get` を呼ぶ/呼ばない条件。 |
| `<workflow>` | `### Step N: 〜` + 手順 + **完了条件**。custom_tool フェンスはここに。 |
| `<decision_rules>` | 「まず〜を確認 → 次に〜」の**思考順序を固定**。ラベル集合・鉄則・誤判定防止ルール。 |
| `<examples>` | `<example index="N">` で **入力→期待される振る舞い** を 3〜5 例。過去に誤判定した所を例示。 |
| `<output_format>` | 後段が解析する agent message の固定フォーマット（前置きの雑談を付けない指示）。 |
| `<error_handling>` | エラー / 対処 の表。 |

## 7. チェックリスト（DB 反映前 = `validate-draft.ts` が機械チェックする項目）

- [ ] `<skill_id>/SKILL.md` のディレクトリ構成で materialize される
- [ ] **`bfc_id` がある**（業務スキルは active な L3 コード / infra は `"-"`）
- [ ] description ≤1024字・三人称・XMLタグなし・何＋いつ
- [ ] body ≤500行
- [ ] cruft（イシュー番号/パイプライン解説/履歴/デッドパス/ラッパー残骸）ゼロ
- [ ] カスタムツール呼び出しが全て `custom_tool toolName="..."` フェンス・toolName は registry に存在
- [ ] タグは行頭単独・内側は空行（プレビュー分割の前提）
- [ ] 各 Step に「完了条件」
- [ ] 判定系なら `<decision_rules>`（思考順序）+ `<examples>`（3〜5）
- [ ] 横断ルール（記録系手書き禁止 / idle 4 分岐 / 完走）は system_prompt 側。SKILL には書かない
- [ ] 業務ロジック・判定基準を削っていない（cruft のみ除去）

## 8. golden reference（実例で学ぶ）

実例となる golden スキルは**社内の作業環境にのみ配置**しており、このリポジトリには含まれない。
FDE は社内環境の `golden/` から、最も近い種別を開いて構造を真似る。

種別ごとに押さえる点:

| 種別 | 学べること |
|---|---|
| **判定系** | `<decision_rules>` の Case 順序を固定、`<examples>` を複数用意、custom_tool フェンス、次スキルへの in-session チェイン、bypass 理由の observability |
| **単機能** | `<decision_rules>` / `<examples>` を**付けない**（冗長回避）、`<error_handling>` で結果値別に分岐、cruft ゼロ |
| **参照系 / cron** | cron_job の起動経路の書き方、actionType の厳密一致分岐（曖昧判定しない）、シート列マッピングの持ち方 |

