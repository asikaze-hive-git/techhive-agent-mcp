---
name: fde-process-intake
description: クライアントの粗いヒアリング資料から、成果物中心（PReP流）の業務モデル生成 → 整合性検証（R1-R11）→ 質問リスト自動生成 → AI 適用分析（BFC マッピング + Risk Tier lookup）→ ToBe 実装ブループリントまでを型どおりに進める FDE 上流工程スキル。新規案件の着手時、ヒアリング資料を受け取った時、AI 適用提案書や見積り根拠を作る時に必ず読む。トリガー: "上流工程", "ヒアリング資料を分析", "業務モデル", "process intake", "AI 適用提案", "ToBe 設計", "新規クライアント着手"。
---

# FDE Process Intake — 成果物中心・上流工程スキル

> 方法論の SoT は [`13-process-intake-doctrine.md`](../../../../docs/revision-v4/13-process-intake-doctrine.md)。本スキルはその実行手順版。
> 全フェーズの作業ファイルは `fde/draft/<client-slug>/` に置く（gitignore 済み。**リポジトリにコミットしない**）。
> **モデルの正本は DB の `業務モデル`**（append-only・version 付き）。手元の model.yaml は作業コピーで、ループの区切りごとに `process_model_upsert`（FDE MCP）で確定登録する。作業再開時は `process_model_get` で最新版を取る。

## 原則（作業中ずっと守る）

- **成果物で聞き、成果物で描く。** process は「〜する」の羅列で増やさない。出力 product を生まない process はモデルに存在してはならない。
- **一発で ToBe まで直行しない。** Phase 1→2→（質問→ヒアリング）→1… のループが正常系。ただし各ループの出口は必ず Phase 2 の機械検証を通す。
- **LLM の裁量は「生成」と「BFC マッピング」だけ。** 検証（R1–R11）とティア判定（BFC lookup）は決定論に落とす。自分の感覚でティアを決めない。
- **推定には必ず `confidence: low` を付ける。** 確信のない補完を high のまま残すと質問リストから漏れ、稼働後に事故る。

## Phase 0 — Intake（素材収集）

1. `fde/draft/<client-slug>/intake/` に素材を集める: 商談メモ / 議事録 / 現行手順書 / 帳票・シートのサンプル / 画面キャプチャ / フロー図。
2. 素材が揃わなくても止まらない。**あるものだけで Phase 1 へ**（欠落は Phase 2 が質問リストとして回収する）。

**完了条件**: 素材の一覧（何があって何が無いか）を `intake/README.md` に 1 行ずつ記録した。

## Phase 1 — As-Is 業務モデル生成

1. [`templates/process-model.template.yaml`](../../../templates/process-model.template.yaml) をコピーして `draft/<client-slug>/model.yaml` を作る。
2. 素材から **products / actors / processes / goals / external_processes** を抽出して埋める。記述規律:
   - 物理帳票をそのまま product にしない。目的の異なる情報の塊は分割する（「申込書」→「申込者情報」+「申込証票」）。
   - 状態が変われば別 product（`state` フィールドで区別）。
   - 共有され管理されているものだけが product。個人メモ依存を見つけたら `sot: tribal` で必ず記録（AI 移管の最大リスク）。
   - human actor には `insight`（本音の運用）欄を設ける。素材から読み取れなければ**空欄のまま**にする（R9 が質問化する）。
3. 全素材が products / processes のどれかに紐付いたか確認。紐付かない素材は「スコープ外」として README に記録。

**完了条件**: model.yaml が YAML として valid で、未確定箇所すべてに `confidence: low` が付いている。

## Phase 2 — 整合性検証（決定論）→ 質問リスト生成

model.yaml を JSON 化して FDE MCP の **`model_validate`** ツールに渡す（検証コードは `apps/src/lib/process-model/validate.ts`。自分の目視でチェックを代替しない）。違反は NG（モデル修正必須）/ ASK（質問リスト行き）:

| # | ルール | 種別 |
|:--|:--|:--|
| R1 | 生成 process を持たない product（orphan） | ASK |
| R2 | どの process からも参照されない product（dead） | ASK |
| R3 | inputs も sync も空の process | ASK |
| R4 | actor 不在の process | NG |
| R5 | どの goal にも連鎖しない final product / final に至らない goal | ASK |
| R6 | milestone product がひとつも無い業務スコープ | ASK（HITL 設計不能のため必須回収） |
| R7 | product の状態遷移に生成 process が無い（状態の飛び） | ASK |
| R8 | `pii: true` の product に保持・スクラブ方針が未付与 | NG |
| R9 | human actor の insight が未聴取（空欄）/ duty と矛盾 | ASK |
| R10 | `confidence: low` の残存 | ASK |
| R11 | final product から入力/同期関係を逆走して到達できないノード（Backward 到達性） | ASK |

ASK 違反は `draft/<client-slug>/questions.md` に変換する。各行は **誰に / 何を / どう聞くか** まで書く（例: R1 違反 P7 →「経理の◯◯さんに: 『請求ドラフトはどこから来ますか？誰がいつ作りますか？』」）。

`model_validate` の返す `questions` を `draft/<client-slug>/questions.md` に写す（自作しない — ツール出力が台本）。

**完了条件**: NG がゼロ。ASK が全件 questions.md 化されている。questions.md がそのまま 2 巡目ヒアリングの台本になる。**ループの区切り（ヒアリング前後）で `process_model_upsert`（`commit: true`）を実行して版を DB に確定する**（NG が残っていると commit は拒否される。version は自動採番）。消化したら Phase 1 に戻って model.yaml を更新する。

## Phase 2.5 — 業務フローの可視化と登録（/dashboard/process）

ヒアリングと並行して、クライアントと一緒に見る**人間の業務フロー**（成果物モデルとは別のタスクフロー面）を作る:

1. **mermaid で走り書き**: [`mermaid-diagrams`](../mermaid-diagrams/SKILL.md) スキルを読み、flowchart で業務フローを描く（`draft/<client-slug>/workflow-<L2>.mmd`）。**ノードのラベル先頭に BFC コードを付ける**（例: `A[1.3.6 面接日程調整]`）— これが l3std ノードになる。コード無しは ext（BFC 外業務）、`[/メモ/]` は付箋になる。
2. **FDE 目視確認**: mermaid をレンダリングしてクライアント/自分で確認・修正（この段階は何度でも描き直せる）。
3. **承認後に DB へ**: `department_workflow_upsert`（L2 キー → mermaid テキスト、`commit: false`）で変換サマリを確認 → 問題なければ `commit: true`。`/dashboard/process` の該当部門にそのまま表示される。既存フローの更新は先に `department_workflow_get` で `last_saved_at` を取る（楽観ロック）。
4. **Phase 4 完了後の別経路**: `department_workflow_generate` で業務モデル + ai_fit から叩き台を機械導出することもできる（bfc_id の L2 でタブが自動構成される）。ゼロから mermaid を描くか、モデルから導出して直すかは素材の揃い方で選ぶ。

**完了条件**: `/dashboard/process` にクライアント合意済みの As-Is 業務フローが表示されている。

## Phase 3 — 構造・リスク分析

検証済みモデルに対して分析レポート `draft/<client-slug>/analysis.md` を書く:

1. **責任集中 / 単一障害点**: 1 actor に process が集中していないか。その人が休むと止まる業務はどれか。
2. **滞留点**: 同期関係（揃うまで待つ束ね）の箇所 = 滞留アラート（aggregate_notify）の設計候補。
3. **インサイト起因リスク**: duty と insight の乖離箇所。ToBe で Rules に昇格させる候補を列挙。
4. **PII フラグ**: `pii: true` の product 全件に保持・スクラブ方針を付与（[10-data-retention.md](../../../../docs/revision-v4/10-data-retention.md) 準拠）。
5. **Backward 検証の完走記録**: final product ごとに逆走パスを残す。

**完了条件**: PII 全件に方針付与済み。ボトルネック（最大の障害の根本原因）を 1 つ特定して明記した。

## Phase 4 — AI 適用分析（BFC マッピング + Tier lookup)

1. 各 process を **BFC 分類にマッピング**する（confidence 付き）。
   - `bfc_search` MCP ツールで候補を引く（業務ステップの自然文 → スコア順候補。confidence=low の候補は鵜呑みにせず質問リストへ回す）。補助として `catalog_list` の bfc_index で全体を俯瞰する。
   - ⚠️ `bfc_search` が返す tier は **S/M/L/XL の規模ラベル（見積り用）であり Risk Tier ではない**。
2. deployment（接続手段）を判定する。判定順は API/コネクタ・ファースト:
   - 公式 API + コネクタ実装済 → `connector` / API はあるがコネクタ未実装 → `custom_tool`（**`tool_request` で開発者起票**。自分で作らない）/ Web UI のみ → `rpa_cdp`（有人監督ブラウザ）/ ローカル計算のみ → `sandbox` / 対人折衝・裁量判断 → `human`
3. bfc_id と deployment を `ai_fit:` に記入したら **`ai_fit_analyze`（FDE MCP）を実行**する。残りは決定論で補完される:
   - **Risk Tier**: `default_risk_tier` の lookup（1-2 → auto / 3-4 → confirm / 未設定・未マッピング → confirm）。**自分で判定しない**
   - **prerequisites**: SoT 整備タスク（paper/tribal/none 入力）の自動生成
   - **issues**: PII 取扱い / HITL ゲート位置（confirm なのに milestone を生まない）/ 未マッピングの列挙 → 解消して再実行
4. 返却された `ai_fit` を model に反映し、`process_model_upsert`（`status: ai_fit_done`, `commit: true`）で確定する。
5. クライアント向け **AI 適用提案書** `draft/<client-slug>/proposal.md` を書く。
   - 構成: 「自動化される業務 / 人間に残る業務（HITL 込み）/ 前提整備」の 3 リスト + 判定表。
   - **非エンジニアが読める日本語で**。persona_id・テーブル名・BFC 内部 ID 等の裏側表現を出さない。

**完了条件**: 全 process に deployment / risk_tier / prerequisites の 3 判定が付いた。

## Phase 5 — ToBe 再設計 + 実装ブループリント

クライアントが提案書に合意したら、**`tobe_generate`（FDE MCP）で実装ブループリントの叩き台を機械導出**する（全 process の deployment 判定が前提。未判定が残ると実行できない）:

| ToBe 要素 | 導出規則（tobe_generate が実行） |
|:--|:--|
| skill 分割 | サブプロセス単位（マイルストン成果物間）。skill_id・label は業務語にリネームしてよい |
| HITL ゲート | `confirm` 判定の process が生む milestone/final の位置 |
| triggers | 自動化 process に定義された trigger（重複排除）。0 件なら warning |
| config 骨格 | `sot: spreadsheet` の products params → シート列定義 |
| human_tasks | `deployment: human` の process → 部署 / human workflow |
| BFC 見積り | final products × 月次ボリューム × bfc_id |
| workflow_graph | direct 形式の叩き台（レビュー後 `workflow_graph_upsert` にそのまま渡せる） |

出力は**叩き台**。skill の切り方・名前・トリガーをレビュー・調整してから `model.tobe` に格納する。

**完了条件 = 移管**: ブループリントが揃ったら `process_model_upsert`（`status: tobe_agreed`, `commit: true`）で最終版を確定し、下流へ:

1. **skill 執筆** → 必ず [`author-skill`](../author-skill/SKILL.md) を読んでから書く
2. **persona 草案** → 必ず [`author-persona`](../author-persona/SKILL.md) を読んでから作る
3. **品質ゲート** → [`techhive-skill-evaluator`](../techhive-skill-evaluator/SKILL.md) で Approve を取る
4. **登録・デプロイ** → FDE MCP: `skill_upsert` → `persona_upsert` → `bundle_validate` → `deploy` → `deploy_checklist`

## 稼働後（このスキルに戻ってくる時）

`process_model_get` で最新版を取得し、業務台帳 の実績（滞留・件数・HITL 却下率）とズレたら、**モデル側を直して `process_model_upsert` で version を上げる**。形骸化したモデルは捨てたのと同じ。推論の質の問題は [`techhive-session-inference-analyzer`](../techhive-session-inference-analyzer/SKILL.md) へ。

## エラー・例外時の挙動

| 状況 | 挙動 |
|:--|:--|
| 素材が少なすぎて Phase 1 が埋まらない | 止まらず、埋まった範囲で Phase 2 へ。質問リストが「初回ヒアリングの台本」になる |
| BFC 分類にどうしても当たらない process | 暫定 bfc なし + `risk_tier: confirm` 固定で先へ。#577 に分類追加候補としてメモ |
| クライアントが提案書の一部のみ合意 | 合意済み process だけで Phase 5 へ。未合意分は model.yaml に `status: on_hold` を付けて温存 |
| 実データをリポジトリにコミットしそうになった | draft/ 以外に置かない。既にコミットした場合は履歴からの除去を開発者に相談（push 前なら reset） |
