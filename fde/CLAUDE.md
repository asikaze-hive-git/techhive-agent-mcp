# FDE ワークスペース — TechHive Agents

> **これは FDE（Forward Deployed Engineer）の作業起点ディレクトリである。**
> クライアント案件の上流工程（ヒアリング → 業務モデル → AI 適用設計）から、スキル執筆・ペルソナ組成・デプロイ・稼働後改善まで、FDE の作業はここで Claude Code を起動して行う（`cd fde && claude`）。
> 目的は **FDE 運用の脱属人化**: 誰がやっても同じ判断基準・同じフォーマット・同じ品質ゲートを通る。
>
> apps/ のコードを触る作業はここではやらない（それは開発者の領分。[apps/AGENTS.md](../apps/AGENTS.md) 参照）。

---

## 1. FDE の責務境界（最初に頭に入れる）

FDE は **既製ブロックの組み立て役** である（[11-fde-agent-mcp.md §1](../docs/revision-v4/11-fde-agent-mcp.md)）:

| 対象 | FDE がやる | FDE がやらない |
|:---|:---|:---|
| 上流工程（業務モデル・AI 適用設計・見積り根拠） | ✅ `fde-process-intake` スキルで型どおりに | — |
| スキル執筆（SKILL.md 本文） | ✅ `author-skill` 規約で執筆、`skill_upsert` で版管理 | — |
| ペルソナ組成・配線・cron・部署 | ✅ `author-persona` → `persona_upsert` | — |
| デプロイ | ✅ FDE MCP の `deploy`（`bundle_validate` 通過後） | — |
| カスタムツール / コネクタ / アダプタの新規実装 | — | ❌ 開発者へ `tool_request` で起票。**自分で作らない** |
| `接続情報`（認証情報）の作成 | — | ❌ 既存を tool_id でリンクするのみ |
| DB スキーマ変更・migration | — | ❌ 開発者の領分 |

## 2. 行動原理 — PReP 由来の 5 箇条

上流工程の思想的土台は成果物中心モデリング（PReP モデル）。SoT は [13-process-intake-doctrine.md](../docs/revision-v4/13-process-intake-doctrine.md)。日々の判断はこの 5 箇条に凝縮される:

1. **タスクではなく成果物で聞く。** 「何をしていますか」ではなく「**何が生まれて、誰が何に使いますか**」。成果物は実物（シート・帳票・画面）を見せてもらって検証できる。状態が変われば別の成果物として扱う（「申込書:受付済」≠「申込書:確認済」）。
2. **マイルストン成果物 = HITL ゲート。** 「どの時点で『ここまでは OK』と品質を確かめますか」の答えが、そのまま ToBe の人間承認ポイントになる。マイルストンが見つからない業務は HITL 設計不能 — 必ず聞き直す。
3. **インサイト（本音）を必ず聴取する。** 建前の手順と違う「本音の運用」（例: 欠品が怖いから多めに発注）は AI 移管で消える最大のリスク。聞き出したら skill の Rules に明文化して昇格させる。人事評価の材料にはしない — 共有範囲に注意。
4. **Backward に検証する。** モデルもスキルチェーンも、最終成果物から逆に「これはなぜ要るのか」を辿って検証する。逆走して到達できないノードは描き漏れか、スコープ外の混入。
5. **聞き忘れは現地で気づく仕組みで潰す。** ヒアリング直後に必ず整合性検証（R1–R11）を回し、違反を**質問リスト**に変換してから 2 巡目に行く。記憶と勘で質問を組み立てない。

## 3. 標準ワークフロー（案件のライフサイクル）

```
【上流】 fde-process-intake スキル
  ヒアリング素材 → As-Is 業務モデル → R1-R11 検証 → 質問リスト → (2巡目ヒアリング)
  → AI 適用分析（BFC マッピング → Risk Tier は lookup）→ ToBe ブループリント → クライアント合意
      ↓
【執筆】 author-skill スキル（規約） + author-persona スキル（persona.json スキーマ）
  ブループリントの skill 分割案 → SKILL.md 執筆 → persona 草案
      ↓
【品質ゲート】 techhive-skill-evaluator スキル
  Approve が出るまで deploy に進まない（Revise / Block は差し戻し）
      ↓
【登録・デプロイ】 techhive-agent MCP
  skill_upsert → persona_upsert → bundle_validate → deploy → deploy_checklist
      ↓
【稼働後改善】 techhive-session-inference-analyzer スキル
  セッションログ横断分析 → 改善所見 → skill/system_prompt 改善 → (再び品質ゲートへ)
  稼働実績（滞留・HITL 却下率）が業務モデルとズレたらモデル側も更新する（モデルは生き物）
```

## 4. スキルマップ — この場面では必ずこのスキルを読む

⚠️ **MCP ツールを叩く前に、対応するスキルを読むこと。** MCP は実行手段であってフォーマットの教科書ではない。スキルを読まずに `skill_upsert` / `persona_upsert` した成果物はレビューで差し戻す。

| 場面（トリガー） | 必読スキル | 何が書いてあるか |
|:---|:---|:---|
| 新規案件の上流工程を始める / ヒアリング資料を貰った | [`fde-process-intake`](.claude/skills/fde-process-intake/SKILL.md) | 業務モデル生成 → 検証 → 質問リスト → BFC/Tier → ToBe の全手順 |
| SKILL.md を書く・直す（`skill_upsert` の前に**必ず**） | [`author-skill`](.claude/skills/author-skill/SKILL.md) | XML タグ構造 / custom_tool フェンス / Rules 層分離 / frontmatter 制約 / golden 実例 3 本 |
| ペルソナを作る・配線する（`persona_upsert` の前に**必ず**） | [`author-persona`](.claude/skills/author-persona/SKILL.md) | persona.json スキーマ / system_prompt に横断ルール集約 / **skills_blueprint はチェイン先まで全部入れる** |
| スキルをデプロイする前の品質チェック | [`techhive-skill-evaluator`](.claude/skills/techhive-skill-evaluator/SKILL.md) | 静的 lint + 挙動 judge の 2 レイヤー採点、Approve / Revise / Block |
| 稼働中ペルソナの推論の質を改善したい | [`techhive-session-inference-analyzer`](.claude/skills/techhive-session-inference-analyzer/SKILL.md) | INF-1..6 rubric / 複数セッション横断 / findings 記録 |
| 業務フロー・図を mermaid で描く（ヒアリング中の可視化） | [`mermaid-diagrams`](.claude/skills/mermaid-diagrams/SKILL.md) | flowchart 等 9+ 種の構文リファレンス（出典: softaworks/agent-toolkit, MIT） |

## 5. techhive-agent MCP（FDE の実行基盤）

接続: `claude mcp add --transport http techhive-agent https://mcp.agents.techhive.bz/mcp`（初回はブラウザで THA ログイン + 同意。トークン手貼り不要）。詳細は [11-fde-agent-mcp.md](../docs/revision-v4/11-fde-agent-mcp.md)。

| よく使うツール | 用途 | 注意 |
|:---|:---|:---|
| `list_my_orgs` / `inspect` | 担当 org / ペルソナ現況の確認 | 作業前にまず現況を見る |
| `catalog_list` | 利用可能なツール・コネクタのカタログ | 無いものは `tool_request` で開発者へ |
| `bfc_search` | 業務ステップの自然文から BFC 候補分類をスコア順に返す（上流工程 Phase 4 用） | 返る tier は S/M/L/XL 規模ラベル（Risk Tier ではない）。confidence=low は質問リストへ |
| `model_validate` | 業務モデルの決定論検証 R1–R11 + 質問リスト生成（上流工程 Phase 2） | 目視チェックで代替しない。NG=修正必須 / ASK=質問リスト行き |
| `process_model_upsert` / `process_model_get` | 業務モデルの DB 確定登録（append-only・version 自動採番）/ 読み取り | **モデルの正本は DB**。NG が残ると commit 拒否。作業再開は get から |
| `ai_fit_analyze` | AI 適用分析の決定論部分（Risk Tier lookup / SoT 整備 prerequisites / PII・HITL 位置検査） | Risk Tier を自分で判定しない。issues を解消 → ai_fit_done で確定 |
| `tobe_generate` | ToBe 実装ブループリントの機械導出（skill 分割 / HITL / triggers / workflow_graph 叩き台） | 全 process の deployment 判定が前提。出力は叩き台 — レビューして model.tobe へ |
| `department_workflow_get` / `department_workflow_upsert` | **人間の業務フロー**（/dashboard/process = `部署の業務フロー`）の読取・登録 | upsert は mermaid テキスト受付（ラベル先頭に BFC コードで l3std）。dry-run で変換を目視確認 → commit。楽観ロック = get の last_saved_at |
| `department_workflow_generate` | 業務モデル + ai_fit → 部門ワークフロー叩き台の機械導出（L2 タブ自動構成） | 出力をレビューして upsert（直値渡し）で保存 |
| `skill_get` / `skill_versions` / `skill_upsert` | スキル読取・版管理・更新 | **編集前に旧版スナップショットが versions に残ることを確認**。SoT は DB（`スキル台帳.content`）。リポジトリ内の SKILL.md コピーを根拠にしない |
| `skill_evaluate` | スキル品質のサーバ側評価 | ローカルの techhive-skill-evaluator と併用 |
| `persona_get` / `persona_upsert` | ペルソナ読取・束で原子的に更新 | `enabled` は作成時 false 固定（有効化は人間） |
| `workflow_graph_upsert` | **AI ペルソナのスキルフロー図**の格納（mermaid / PNG / direct → `ペルソナ定義.workflow_agent`） | ③AI レイヤ。②人間の業務フロー（department_workflow_*）とは別物。ToBe 確定後に描く |
| `bundle_validate` | blueprint ⊆ ペルソナのスキル構成 等のクロステーブル整合検証 | **deploy 前の最終防衛線。スキップ禁止** |
| `deploy` / `deploy_checklist` | Console push + Agent 登録/更新 | デプロイ先ワークスペースの org 接続を確認（env fallback での誤着地禁止） |
| `persona_activity` / `session_diagnose` / `read_session_logs` | 稼働状況・セッション調査 | |
| `record_finding` / `update_finding_status` | 推論分析の所見記録 | 書込はこのツール経由のみ |
| `tool_request` | 不足ツール・コネクタの開発者起票 | FDE は実装しない |

## 6. 運用ルール（事故防止・全員厳守）

1. **生成物・クライアント実データはすべて `draft/` 配下に置く。** ヒアリング資料・業務モデル・提案書・ペルソナ/スキル草案（`draft/<persona_id>/` や `draft/<client-slug>/`）など、FDE 作業で生成・受領するファイルの置き場は [`draft/`](draft/) 一択。gitignore 済みなので無駄な差分が出ない。正本はクライアント案件用 Drive。リポジトリに入れてよいのはテンプレート（[`templates/`](templates/)）と匿名化済み golden サンプルのみ。
   **⚠️ Claude Code への明示ルール: `draft/` 配下は git 非追跡だが、読み込み・参照して構わない（むしろ作業の正であり必ず参照する）。** 非追跡であることを理由に検索・読取の対象から外さないこと。`draft/` を探すときは Glob/Read を直接使う（git ベースの探索だと漏れる）。
2. **DB が SoT。** スキル本文の正は `スキル台帳.content`。読み書きは必ず MCP（`skill_get` / `skill_upsert`）経由。`apps/src/skills/**` は死んでいる — 参照禁止。
3. **スキル改修前に版を確認。** `skill_versions` で旧版が残ることを確認してから `skill_upsert`（published_version_id が NULL のスキルは即本番反映される）。
4. **skills_blueprint にはチェイン先スキルも全部入れる。** エントリポイントだけ attach すると in-session チェーンが途中で止まる（実事故あり）。
5. **クライアント向け成果物（提案書・UI 文言）に裏側表現を出さない。** persona_id・テーブル名・enum 生値・ISSUE 番号は日本語ラベルへ。
6. **HITL は迷ったら confirm。** ティアを緩める判断は稼働実績を見てから。クライアント自身によるティア変更は同意証跡つきの専用フロー（設計中: #577 v2 §5）。
7. **デプロイは bundle_validate → deploy → deploy_checklist の順を崩さない。** 検証を飛ばした部分書き込みが「skills_blueprint 空のスケルトン」事故の原因だった。
8. **PII を含む成果物を新しい表示面・シートに流すときはスクラブ方針を先に確認**（[10-data-retention.md](../docs/revision-v4/10-data-retention.md)）。

## 7. 必読ドキュメント（判断に迷ったらここへ戻る）

| ドキュメント | いつ読むか |
|:---|:---|
| [13-process-intake-doctrine.md](../docs/revision-v4/13-process-intake-doctrine.md) | 上流工程の全て（本ファイル §2–3 の詳細・検証ルール・スキーマ） |
| [11-fde-agent-mcp.md](../docs/revision-v4/11-fde-agent-mcp.md) | MCP の設計・データモデル・責務境界 |
| [04-mcp-and-tools.md](../docs/revision-v4/04-mcp-and-tools.md) | Risk Tier / HITL / custom tool の scope |
| [05-boundary-rules.md](../docs/revision-v4/05-boundary-rules.md) | 7 つの境界ルール（何を作ってよくて何がダメか） |
| [08-tenant-onboarding.md](../docs/revision-v4/08-tenant-onboarding.md) | テナント追加の 6 ステート（org / admin / persona / Agent / token / skill） |
