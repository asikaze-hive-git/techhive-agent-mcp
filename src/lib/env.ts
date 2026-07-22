/**
 * 環境変数の検証（Zod）。起動時に欠落を early-fail させる。
 * 秘密は FDE_DISPATCH_SECRET だけ。他は Supabase 公開値 + dispatch URL。
 */
import { z } from "zod"

const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  FDE_DISPATCH_URL: z.string().url(),
  FDE_DISPATCH_SECRET: z.string().min(1),
})

let cached: z.infer<typeof schema> | null = null

/** 検証済み env を返す（初回のみ検証）。route ハンドラ内で呼ぶ（ビルド時評価を避ける）。 */
export function getEnv(): z.infer<typeof schema> {
  if (cached) return cached
  const parsed = schema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    FDE_DISPATCH_URL: process.env.FDE_DISPATCH_URL,
    FDE_DISPATCH_SECRET: process.env.FDE_DISPATCH_SECRET,
  })
  if (!parsed.success) {
    throw new Error(
      `Invalid environment: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}`,
    )
  }
  cached = parsed.data
  return cached
}
