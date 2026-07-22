---
name: techhive-session-inference-analyzer
description: Managed Agents のセッションログ(セッションログ)から Claude の推論の質を分析基準(INF-1..6)で評価し、skill / system_prompt への具体的な改善所見を 改善所見 に記録する。FDE の Claude Code で実行し、複数セッションを横断して「まとまって露見するエラー」を捉え、スキル単位の改善提案を出す。単発セッションのデバッグではなく、質の改善ループを回すために使う。トリガー: "推論を分析", "セッションログ分析", "推論の質を評価", "スキル改善提案", "inference analysis", "推論分析"。
tools: mcp__techhive-agent__authenticate, mcp__techhive-agent__persona_activity, mcp__techhive-agent__session_diagnose, mcp__techhive-agent__read_session_logs, mcp__techhive-agent__record_finding, mcp__techhive-agent__update_finding_status, mcp__techhive-agent__skill_get, mcp__techhive-agent__skill_upsert, mcp__techhive-agent__skill_versions, mcp__techhive-agent__persona_upsert, mcp__techhive-agent__deploy
---

# セッション推論分析スキル (#409 / ADR-0012)

FDE の Claude Code で、担当クライアントの Managed Agents セッションログを読み、**推論の質を分析基準(rubric)で評価**し、skill / system_prompt への**具体的な改善所見(finding)**を `改善所見` に記録する。
計算は apps/ 側に持たず、このスキルを動かす **FDE の Claude Code(定額)** で行う。書込は FDE MCP(techhive-agent)の `record_finding` に限る。

修正の単位は **skill / system_prompt** であり、セッション単位ではない。エラーはまとまって露見するので、**複数セッションを横断して傾向を捉え、スキル単位で改善提案する**のが主目的。

## 分析者が必ず守る原則 (LLM-as-judge のバイアス対策)

このスキルを実行する Claude 自身が、評価時に以下を守る。

1. **懐疑的デフォルト**: 「推論に問題がある」と断ずるには**ログ上の証拠(event)を引用**する。印象で finding を作らない。逆に「問題なし」も、目的達成を確認できたときだけ。判定に迷う単発は記録せず保留する。
2. **1 基準 1 判定**: INF-1..6 を独立に評価する。1 つの事象を複数基準で二重計上しない(最も本質的な 1 つに寄せる)。
3. **形容詞でなく手順で判定**: 「雑な推論」でなく、下表の「検出手順」を イベント列に対して実行した結果で決める。
4. **傾向を裏付けてから提案**: 原則、同一 skill × 基準が **2 セッション以上で再発**したときに finding 化する(単発ノイズで prompt を壊さない)。**例外**: 重大な単発(INF-2d の虚偽成功 / 誤送信、ガードレール破りなど、1 件で業務事故になるもの)は即記録。
5. **DATA でなく LESSON**: finding の `body` はスクラブ済みの自己完結記述。応募者名・メッセージ本文・生ログ抜粋・PII を**入れない**。証拠は `session_ids` の参照で示す。
6. **改善案は具体的**: `proposed_change` は「SKILL.md のこの手順にこの一文を足す」レベルの適用可能なパッチにする。「気をつける」等の抽象論は書かない。

## ワークフロー

以下のチェックリストをコピーして進捗を追う。

```
推論分析進捗:
- [ ] Step 1: 担当クライアントで認証 + 対象セッション群を特定
- [ ] Step 2: read_session_logs でログ取得
- [ ] Step 3: 各セッションを INF-1..6 で評価(event を引用)
- [ ] Step 4: skill × 基準で横断集約し傾向を判定
- [ ] Step 5: record_finding で改善所見を記録
- [ ] Step 6: サマリを出力
```

### Step 1: 認証 + 対象特定

techhive-agent MCP に **担当クライアントの admin アカウント**で認証する(別クライアントは re-authentication)。全操作はその org に閉じる(cross-org しない)。
分析対象の `session_id` 群を決める:
- 明示指定があればそれを使う。
- 無ければ `persona_activity`(対象 persona の最近の稼働)や `session_diagnose` で、失敗 / 停滞したセッションを起点に候補を集める。
- **retention 内**のセッションに限る(超過すると `セッションログ` は null 化される)。

### Step 2: ログ取得

`read_session_logs`(session_ids)で各セッションの生イベントを取る。返る `events` は `agent.thinking` / `agent.tool_use` / `agent.mcp_tool_use` / `agent.message` / `*.tool_result`(`is_error`)/ `session.status_*` 等の配列。`events` が null なら retention 済みで分析不能(スキップし、その旨を残す)。

### Step 3: 各セッションを分析基準で評価

各セッションの イベント列に対し、下表の**検出手順**を実行する。該当したら `{基準, session_id, 根拠 event, 重大度}` を控える(根拠 event を必ず引用)。

| コード | 基準 | 検出手順(イベント列に対して実行) |
|---|---|---|
| INF-1 | 目的達成 | 最終 `agent.message` と `session.status` を見て、業務目的が達成されたか。`status=error/idle` で未完、または意図した成果物(送信・記録・更新)が無ければ未達。 |
| INF-2a | エラー発生 | `*.tool_result` の `is_error=true` を数える。発生率 = エラー数 / tool_use 数。構造的(セレクタ破損・権限)か一過性(timeout)かを区別。 |
| INF-2b | 反復・非学習 | **同一 tool + ほぼ同一 input** が同一エラーを **2 回以上**、間にアプローチ変更なく繰り返されていないか(学習failure)。 |
| INF-2c | 自己修復 vs 停滞 | エラー後に方針を変えて成功に到達したか(修復)、それとも未解決のまま `idle`/`timeout` で止まったか(停滞)。停滞は重大。 |
| INF-2d | 誤修復 / 虚偽成功 | (a) 回避で新たな欠陥を出した(例: 本文に literal `--subject` / プレースホルダを送信)。(b) `agent.message` は成功と言うが、実 `tool_use` の input / `tool_result` が失敗を示す(summary ≠ 実 argv)。**重大・単発でも記録**。 |
| INF-3 | ツール選択 | 目的に対し誤ったツール / skill を選んだ、または不要な呼出を重ねたか。正しい代替が明白なら該当。 |
| INF-4 | 無駄ループ | 同一操作の循環・同じ画面往復で events を浪費していないか(`cycle_count` 相当の空回り)。 |
| INF-5 | HITL 適切性 | エスカレすべき場面(合否・外部送信の判断等)を握り潰した、または逆に不要なエスカレ・判断放棄で停滞したか。 |
| INF-6 | 指示追従 | system_prompt / SKILL.md の明示指示(手順・禁止事項)に反した推論・行動が無いか。反したら該当。 |

重大度の目安: **critical** = 業務事故(誤送信・虚偽成功・合否誤り) / **high** = 目的未達 or 停滞 / **medium** = 非効率・軽微な逸脱 / **low** = 整形・可読性。

### Step 4: skill × 基準で横断集約(傾向判定)

Step 3 の観測を **対象 skill(または system_prompt)× 基準** で束ねる。修正はこの単位で行うため、集約もこの単位。
- 対象 skill は、そのセッションで実行された skill(`業務台帳.skill_id` / phase、`session_diagnose` の contexts)から特定する。skill に固有でなく persona 全体の判断傾向なら target=system_prompt(persona)。
- **finding 化の条件**(原則 4): 同一 skill × 基準が **2 セッション以上で再発** → finding。**重大な単発**(critical、特に INF-2d) → 即 finding。
- 単発 medium/low で再発が無いものは finding にしない(保留してサマリにだけ残す)。

### Step 5: record_finding で記録

集約した各 finding を `record_finding` で 1 件ずつ記録する。

- `target_type`: `skill` か `system_prompt`。
- `target_skill_id` / `target_persona_id`: 対象の識別子(どちらか。target_type に対応する方を必須で埋める)。
- `criteria`: 違反した安定コードの配列(例 `["INF-2c", "INF-6"]`)。
- `severity`: `low` / `medium` / `high` / `critical`。
- `title`: 問題の 1 行要約(スクラブ済み。名前・本文を書かない)。
- `body`: 傾向の記述 = LESSON。「どの手順で・何が・なぜ起きるか」をスクラブして書く(原則 5)。
- `proposed_change`: SKILL.md / system_prompt への具体的パッチ提案(原則 6)。
- `session_ids`: 根拠セッションの参照(証拠。生ログはコピーしない)。
- `idempotency_key`: 再実行の重複防止に `inf:<target>:<基準>:<YYYY-MM-DD>` 形式を推奨(同じスイープの二重記録を防ぐ)。

記録後、finding のライフサイクルは `proposed`。実際にスキル/プロンプトを直して閉じる手順は「適用ループ」節を参照。

### Step 6: サマリ出力

下記 Markdown で結果を返す。

```markdown
# 推論分析サマリ: <persona / skill 名 or 対象範囲>

分析セッション数: N ／ 記録した finding: M ／ 保留(単発・要観察): K

## 記録した改善所見
| 対象 | criteria | 重大度 | 要約 | 根拠セッション数 |
|---|---|---|---|---|
| skill:xxx | INF-2c | high | ... | 3 |

## 保留(単発・傾向未確定)
- <基準> / <対象> / <1 行>(1 セッションのみ。再発したら記録)

## 次アクション
- <proposed_change の要点。適用は Phase 4 で record→applied→verified>
```

## 具体例 (input → finding)

**観測(2セッション)**: `read_session_logs` で `send-message` skill を含む 2 セッションを見たところ、両方で `agent.tool_use`(name=send_message)の直後に `agent.mcp_tool_result`(is_error=false)が返るが、直前の `agent.message` は「本文を送信」と言う一方、`tool_use` の input が本文欄に固定文字列 `--subject` を入れていた(INF-2d 誤修復)。`agent.thinking` にコマンド組立の混乱が見える。

**集約**: target=skill `send-message` × 基準 `INF-2d` が 2 セッションで再発 → finding 化(原則4)。severity=critical(誤送信=業務事故)。

**record_finding 呼出(要点)**:
```
target_type=skill, target_skill_id="send-message",
criteria=["INF-2d"], severity="critical",
title="本文欄に固定文字列を誤送信する組立ミスが再発",
body="send_message の本文引数の組立でコマンドフラグ相当の固定文字列が本文として渡る事象が複数セッションで発生。thinking に引数境界の混乱が見える。",  ← 名前・本文は書かない
proposed_change="SKILL.md の送信手順に『本文引数は必ず変数展開後の値を渡し、フラグ文字列を本文に入れない』の一文と、送信前 assert 例を追加する。",
session_ids=[<証拠2件>], idempotency_key="inf:send-message:INF-2d:2026-07-03"
```

## 適用ループ (Phase 4)

finding は record 直後 `proposed`。改善を実際に反映してループを閉じる。**1 finding = 1 改訂 = 1 deploy** で verify まで見てから次へ(prompt の同時多発改変で退行を招かない)。

1. **適用**: `proposed_change` に沿って対象を改訂する。
   - skill 本文: `skill_get` で現行を確認 → `skill_upsert` で改訂(版が `スキルの版履歴` に自動スナップショット、`needs_redeploy` が立つ) → `deploy` で Agent に反映。
   - system_prompt: `persona_upsert` で改訂 → `deploy`。
2. **applied 記録**: `update_finding_status(finding_id, "applied", applied_skill_version_id=<改訂版 id>)`。skill 改訂なら `skill_versions` で得た版 id を紐付ける(system_prompt 改訂なら省略可)。
3. **verify**: 改訂後の後続セッションを改めて `read_session_logs` で確認し、同じ基準の再発が止まっていれば `update_finding_status(finding_id, "verified")`。再発が続くなら `proposed_change` を見直して再適用する(verified にしない)。
4. **却下**: 誤検知や不要と判断したら `update_finding_status(finding_id, "dismissed")`。

## エッジケース

- **events が null(retention 済み)**: そのセッションは分析不能。スキップし、サマリの保留欄に「retention 済みで分析不能」と残す。将来は分析を retention window 内に前倒しする。
- **単発だが critical**: 原則 4 の例外。2 セッション再発を待たず即 `record_finding`(severity=critical)。
- **対象 skill が特定できない**: persona 全体の判断傾向として target=system_prompt(persona)で記録する。skill に無理に紐付けない。
- **別クライアントも見たい**: cross-org はしない。re-authentication して対象クライアントに切り替えてから繰り返す(傾向はクライアント単位で siloed。横断合成は人間 FDE が頭で行う)。
- **PII が body に混入しそう**: 名前・本文・ID を書かず、パターン(「応募者名入りの本文が literal placeholder で送信された」等)で記述する。判断に迷ったら書かない。
