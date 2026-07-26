import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

// A job still 'processing' after this long is treated as dead. The background
// worker is bounded by the extract route's maxDuration, so anything past that
// (plus slack) was killed mid-run — by a function timeout, a deploy, or a
// crash — and will never report a terminal status on its own.
const STALE_AFTER_MS = 6 * 60 * 1000

// Poll target for an extraction queued by POST /api/patterns/upload/extract.
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

    // RLS restricts this to the caller's own jobs.
    const { data: job, error } = await supabase
      .from('pattern_jobs')
      .select(
        'id, status, file_name, selected_size, pattern_id, pattern_name, error, warnings, progress, started_at, created_at'
      )
      .eq('id', id)
      .maybeSingle()

    if (error) {
      console.error('Error fetching extraction job:', error)
      return NextResponse.json({ error: 'Failed to fetch job' }, { status: 500 })
    }

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    const startedAt = job.started_at ?? job.created_at
    const isStale =
      (job.status === 'processing' || job.status === 'pending') &&
      startedAt != null &&
      Date.now() - new Date(startedAt).getTime() > STALE_AFTER_MS

    if (isStale) {
      return NextResponse.json({
        ...job,
        status: 'failed',
        error:
          'Extraction stopped unexpectedly and did not finish. Please try uploading again.',
      })
    }

    return NextResponse.json(job)
  } catch (error) {
    console.error('Error in job status route:', error)
    const message = error instanceof Error ? error.message : 'Failed to fetch job'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
