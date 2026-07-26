import { NextRequest, NextResponse, after } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runExtractionJob } from '@/lib/patterns/extract-job'

// The extraction runs via `after()`, so it counts against this function's
// duration budget. Extraction typically takes 30-60s; allow generous headroom.
export const maxDuration = 300

// Phase 2: queue a full extraction for the user's selected size.
//
// This used to run the extraction inline and hold the request open for the
// whole 30-60s. It now records a job row, hands the work to `after()`, and
// returns 202 immediately — so a client that navigates away or refreshes no
// longer orphans work that is actually succeeding server-side. Clients poll
// GET /api/patterns/jobs/[id] for the outcome.
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { storagePath, selectedSize, fileName } = body as {
      storagePath: string
      selectedSize: string | null
      fileName: string
    }

    if (!storagePath || !fileName) {
      return NextResponse.json(
        { error: 'Missing storagePath or fileName' },
        { status: 400 }
      )
    }

    // Verify the storage path belongs to this user before queueing work
    // against it — the background worker runs with the service-role key and
    // bypasses RLS, so this is the only place ownership is enforced.
    if (!storagePath.startsWith(`${user.id}/`)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const admin = createAdminClient()
    const { data: job, error: jobError } = await admin
      .from('pattern_jobs')
      .insert({
        user_id: user.id,
        status: 'pending',
        storage_path: storagePath,
        file_name: fileName,
        selected_size: selectedSize ?? null,
      })
      .select('id')
      .single()

    if (jobError || !job) {
      console.error('Error creating extraction job:', jobError)
      return NextResponse.json(
        { error: 'Failed to queue pattern extraction' },
        { status: 500 }
      )
    }

    // Runs after the response is sent. Never rejects — runExtractionJob
    // records every failure on the job row instead.
    after(() => runExtractionJob(job.id))

    return NextResponse.json({ jobId: job.id, status: 'pending' }, { status: 202 })
  } catch (error) {
    console.error('Error queueing pattern extraction:', error)
    const message = error instanceof Error ? error.message : 'Failed to process pattern'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
