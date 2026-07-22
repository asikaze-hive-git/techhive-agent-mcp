/**
 * OAuth アクセストークン検証（Supabase OAuth 2.1 Server が発行した user JWT）。
 *
 * apps 側 `verifyOAuthToken`（src/lib/agent-registry/user-client.ts）と同一ロジックを
 * 公開エッジに移植したもの。JWKS で非対称鍵検証するだけで、秘密は不要。
 * ここでの検証は 401 を正しく返すための「軽検証」。認可の正本は apps 側 dispatch が
 * 同じ Bearer を RLS-as-user で再評価する。
 */
import { createClient } from "@supabase/supabase-js"

import { getEnv } from "@/lib/env"

export interface OAuthIdentity {
  /** Supabase user id (JWT sub) */
  userId: string
  email: string | null
}

/** Bearer の OAuth アクセストークンを JWKS 検証し user を特定する。無効なら throw。 */
export async function verifyOAuthToken(accessToken: string): Promise<OAuthIdentity> {
  const env = getEnv()
  const verifier = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  )

  const { data, error } = await verifier.auth.getClaims(accessToken)
  if (error || !data?.claims?.sub) {
    throw new Error(error?.message ?? "invalid access token")
  }

  const claims = data.claims
  return {
    userId: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
  }
}
