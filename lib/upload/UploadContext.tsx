'use client'

import {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
  ReactNode,
} from 'react'

type UploadStatus =
  | 'idle'
  | 'uploading'
  | 'selecting_size'
  | 'extracting'
  | 'success'
  | 'error'

interface UploadState {
  status: UploadStatus
  fileName: string | null
  sizes: string[] | null
  storagePath: string | null
  selectedSize: string | null
  jobId: string | null
  patternId: string | null
  patternName: string | null
  error: string | null
  warnings: string[] | null
}

interface UploadContextType extends UploadState {
  startUpload: (file: File) => void
  selectSize: (size: string) => void
  dismiss: () => void
}

const initialState: UploadState = {
  status: 'idle',
  fileName: null,
  sizes: null,
  storagePath: null,
  selectedSize: null,
  jobId: null,
  patternId: null,
  patternName: null,
  error: null,
  warnings: null,
}

const POLL_INTERVAL_MS = 2000

// Give up after this many consecutive network failures. The job itself is
// durable server-side, so the user can always reload to pick it back up.
const MAX_CONSECUTIVE_POLL_ERRORS = 10

// Extraction now outlives the page: the server owns the job, so persisting the
// id lets a reload rejoin an in-flight extraction instead of orphaning it.
const STORAGE_KEY = 'yarnstash:active-extraction-job.v1'

interface StoredJob {
  jobId: string
  fileName: string
  selectedSize: string | null
}

function readStoredJob(): StoredJob | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredJob
    return parsed?.jobId ? parsed : null
  } catch {
    return null
  }
}

function writeStoredJob(job: StoredJob) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(job))
  } catch {
    // Private browsing or quota — polling still works for this page view.
  }
}

function clearStoredJob() {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Ignore.
  }
}

const UploadContext = createContext<UploadContextType | undefined>(undefined)

export function UploadProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<UploadState>(initialState)
  const uploadingRef = useRef(false)

  // Mirror of `state` for callbacks that must read current values without
  // taking a dependency on them (see selectSize).
  const stateRef = useRef(state)
  stateRef.current = state

  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pollingJobId = useRef<string | null>(null)

  const stopPolling = useCallback(() => {
    if (pollTimer.current) clearTimeout(pollTimer.current)
    pollTimer.current = null
    pollingJobId.current = null
  }, [])

  const startPolling = useCallback(
    (jobId: string, fileName: string) => {
      if (pollingJobId.current === jobId) return
      stopPolling()
      pollingJobId.current = jobId
      let consecutiveErrors = 0

      const tick = async () => {
        // A newer job (or a dismiss) superseded this poll loop.
        if (pollingJobId.current !== jobId) return

        try {
          const response = await fetch(`/api/patterns/jobs/${jobId}`)
          const data = await response.json()
          if (!response.ok) {
            throw new Error(data.error || 'Failed to check extraction status')
          }
          consecutiveErrors = 0

          if (pollingJobId.current !== jobId) return

          if (data.status === 'succeeded') {
            clearStoredJob()
            stopPolling()
            setState((prev) => ({
              ...prev,
              status: 'success',
              patternId: data.pattern_id,
              patternName: data.pattern_name ?? fileName,
              warnings: data.warnings ?? null,
            }))
            return
          }

          if (data.status === 'failed') {
            clearStoredJob()
            stopPolling()
            setState((prev) => ({
              ...prev,
              status: 'error',
              error: data.error || 'Extraction failed',
            }))
            return
          }

          pollTimer.current = setTimeout(tick, POLL_INTERVAL_MS)
        } catch (err) {
          consecutiveErrors++
          if (consecutiveErrors >= MAX_CONSECUTIVE_POLL_ERRORS) {
            console.error('Giving up polling extraction job:', err)
            stopPolling()
            setState((prev) => ({
              ...prev,
              status: 'error',
              error:
                'Lost connection while checking extraction status. It may still be running — reload to check.',
            }))
            return
          }
          pollTimer.current = setTimeout(tick, POLL_INTERVAL_MS)
        }
      }

      void tick()
    },
    [stopPolling]
  )

  // Rejoin an extraction that was still running when the page was last closed.
  useEffect(() => {
    const stored = readStoredJob()
    if (!stored) return

    setState((prev) => ({
      ...prev,
      status: 'extracting',
      fileName: stored.fileName,
      selectedSize: stored.selectedSize,
      jobId: stored.jobId,
    }))
    startPolling(stored.jobId, stored.fileName)

    return () => stopPolling()
  }, [startPolling, stopPolling])

  const queueExtraction = useCallback(
    (storagePath: string, selectedSize: string | null, fileName: string) => {
      fetch('/api/patterns/upload/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storagePath, selectedSize, fileName }),
      })
        .then(async (response) => {
          const data = await response.json()
          if (!response.ok) {
            throw new Error(data.error || 'Failed to process pattern')
          }

          writeStoredJob({ jobId: data.jobId, fileName, selectedSize })
          setState((prev) => ({ ...prev, jobId: data.jobId }))
          startPolling(data.jobId, fileName)
        })
        .catch((err) => {
          console.error('Failed to queue extraction:', err)
          setState((prev) => ({
            ...prev,
            status: 'error',
            error: err instanceof Error ? err.message : 'Failed to process pattern',
          }))
        })
    },
    [startPolling]
  )

  // Phase 1: Upload PDF to storage + extract sizes
  const startUpload = useCallback(
    (file: File) => {
      if (uploadingRef.current) return

      if (file.type !== 'application/pdf') {
        setState({
          ...initialState,
          status: 'error',
          fileName: file.name,
          error: 'Please select a PDF file',
        })
        return
      }

      // A new upload supersedes any previously tracked job.
      stopPolling()
      clearStoredJob()

      uploadingRef.current = true
      setState({
        ...initialState,
        status: 'uploading',
        fileName: file.name,
      })

      const formData = new FormData()
      formData.append('file', file)

      fetch('/api/patterns/upload', {
        method: 'POST',
        body: formData,
      })
        .then(async (response) => {
          const data = await response.json()
          if (!response.ok) {
            throw new Error(data.error || 'Failed to upload pattern')
          }

          const sizes: string[] = data.sizes ?? []

          if (sizes.length <= 1) {
            // One-size or no-size pattern — skip size selection
            setState((prev) => ({
              ...prev,
              status: 'extracting',
              storagePath: data.storagePath,
              selectedSize: sizes[0] ?? null,
            }))
            queueExtraction(data.storagePath, sizes[0] ?? null, file.name)
          } else {
            // Multi-size — show size picker
            setState((prev) => ({
              ...prev,
              status: 'selecting_size',
              sizes,
              storagePath: data.storagePath,
            }))
          }
        })
        .catch((err) => {
          console.error('Upload error:', err)
          setState({
            ...initialState,
            status: 'error',
            fileName: file.name,
            error: err instanceof Error ? err.message : 'Failed to upload pattern',
          })
        })
        .finally(() => {
          uploadingRef.current = false
        })
    },
    [queueExtraction, stopPolling]
  )

  // Reads state outside the updater on purpose: React can double-invoke a
  // setState callback, and queueExtraction now creates a durable job row, so
  // firing it from inside the updater risks queueing the same work twice.
  const selectSize = useCallback(
    (size: string) => {
      const { status, storagePath, fileName } = stateRef.current
      if (status !== 'selecting_size' || !storagePath || !fileName) return

      setState((prev) => ({ ...prev, status: 'extracting', selectedSize: size }))
      queueExtraction(storagePath, size, fileName)
    },
    [queueExtraction]
  )

  const dismiss = useCallback(() => {
    stopPolling()
    clearStoredJob()
    setState(initialState)
  }, [stopPolling])

  return (
    <UploadContext.Provider value={{ ...state, startUpload, selectSize, dismiss }}>
      {children}
    </UploadContext.Provider>
  )
}

export function useUpload() {
  const context = useContext(UploadContext)
  if (context === undefined) {
    throw new Error('useUpload must be used within an UploadProvider')
  }
  return context
}
