/**
 * tools-manifest.json 再生成スクリプト（freee-mcp の generate:references と同じ発想）。
 *
 * バックエンドの権威レジストリ (`GET .../manifest`) から、ツールの名前 / 説明 /
 * 入力スキーマ（JSON Schema）を取得して公開契約として commit する。
 * 実装・秘密は取得しない（スキーマだけ）。返される内容は配信元で整形済みのため、
 * このスクリプトは取得してそのまま書き出すだけで、加工は一切行わない。
 *
 * 使い方:
 *   FDE_MANIFEST_URL=... FDE_DISPATCH_SECRET=... pnpm generate:manifest
 */
import { writeFile } from "node:fs/promises"
import { join } from "node:path"

const OUT = join(process.cwd(), "tools-manifest.json")

async function main() {
  const url = process.env.FDE_MANIFEST_URL
  const secret = process.env.FDE_DISPATCH_SECRET
  if (!url || !secret) {
    throw new Error("FDE_MANIFEST_URL と FDE_DISPATCH_SECRET を環境変数で渡してください")
  }

  const res = await fetch(url, { headers: { "x-fde-dispatch-secret": secret } })
  if (!res.ok) {
    throw new Error(`manifest 取得に失敗 (${res.status}): ${await res.text()}`)
  }

  const manifest = (await res.json()) as { tools?: unknown[] }
  await writeFile(OUT, `${JSON.stringify(manifest, null, 2)}\n`, "utf8")
  console.log(`wrote ${manifest.tools?.length ?? 0} tools → ${OUT}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
