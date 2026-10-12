/**
 * Read-aloud is in private preview: only users listed in READ_ALOUD_USER_IDS
 * (comma-separated Supabase user ids) get it. Unset means nobody — merging
 * this never exposes the feature by accident. "*" opens it to everyone.
 *
 * Enforced in /api/tts, not just the UI: the route answers as if read-aloud
 * were not configured, so the controls stay hidden and the endpoint cannot be
 * called directly to spend ElevenLabs credits.
 */
export function canUseReadAloud(userId: string): boolean {
  const allowed = (process.env.READ_ALOUD_USER_IDS ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
  return allowed.includes('*') || allowed.includes(userId)
}
