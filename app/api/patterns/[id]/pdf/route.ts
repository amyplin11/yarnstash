import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { storagePathForPattern } from '@/lib/patterns/storage-path'

// How long a minted link stays valid. Long enough to follow the redirect and
// for the browser to start the download, short enough that a leaked URL — out
// of history, a referrer header, a shared screenshot — is not a standing grant.
const SIGNED_URL_TTL_SECONDS = 60

/**
 * Hands back the original PDF for a pattern the caller owns.
 *
 * The `pattern-pdfs` bucket used to be public, which made `patterns.pdf_url` a
 * permanently valid unauthenticated link: the URL *was* the permission. Now the
 * bucket is private and this route is the only way in — it checks the session,
 * confirms the row belongs to the caller, and redirects to a signed URL that
 * expires in a minute.
 *
 * Signing runs on the caller's own client, not the service-role one, so the
 * owner-scoped RLS policy on `storage.objects` still applies. Ownership is
 * enforced twice on purpose.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createServerClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: pattern, error: patternError } = await supabase
      .from('patterns')
      .select('id, storage_path, pdf_url')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    // A pattern owned by someone else is a 404, not a 403 — no point
    // confirming that an id exists to someone who cannot read it.
    if (patternError || !pattern) {
      return NextResponse.json({ error: 'Pattern not found' }, { status: 404 })
    }

    const storagePath = storagePathForPattern(pattern)
    if (!storagePath) {
      return NextResponse.json(
        { error: 'This pattern has no stored PDF' },
        { status: 404 }
      )
    }

    const { data: signed, error: signError } = await supabase.storage
      .from('pattern-pdfs')
      .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS)

    if (signError || !signed?.signedUrl) {
      console.error('Error signing pattern PDF url:', signError)
      return NextResponse.json(
        { error: 'Could not open the stored PDF' },
        { status: 500 }
      )
    }

    // 307 keeps the method and, unlike a 301/302, is not cached by the browser
    // — the next click must come back through the auth check above.
    return NextResponse.redirect(signed.signedUrl, 307)
  } catch (error) {
    console.error('Error in GET /api/patterns/[id]/pdf:', error)
    return NextResponse.json({ error: 'Failed to open PDF' }, { status: 500 })
  }
}
