'use client'

import { createContext, useContext, useState, useRef, useCallback, ReactNode } from 'react'

type UploadStatus = 'idle' | 'uploading' | 'selecting_size' | 'extracting' | 'success' | 'error'

interface UploadState {
  status: UploadStatus
  fileName: string | null
  sizes: string[] | null
  storagePath: string | null
  selectedSize: string | null
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
  patternId: null,
  patternName: null,
  error: null,
  warnings: null,
}

const UploadContext = createContext<UploadContextType | undefined>(undefined)

function runExtraction(storagePath: string, selectedSize: string | null, fileName: string, setState: React.Dispatch<React.SetStateAction<UploadState>>) {
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
      setState((prev) => ({
        ...prev,
        status: 'success',
        patternId: data.pattern.id,
        patternName: data.pattern.name ?? fileName,
        warnings: data.warnings ?? null,
      }))
    })
    .catch((err) => {
      console.error('Extraction error:', err)
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: err instanceof Error ? err.message : 'Failed to process pattern',
      }))
    })
}

export function UploadProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<UploadState>(initialState)
  const uploadingRef = useRef(false)

  // Phase 1: Upload PDF to storage + extract sizes
  const startUpload = useCallback((file: File) => {
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
          // One-size or no-size pattern — skip size selection, go straight to extraction
          setState((prev) => ({
            ...prev,
            status: 'extracting',
            storagePath: data.storagePath,
            selectedSize: sizes[0] ?? null,
          }))
          runExtraction(data.storagePath, sizes[0] ?? null, file.name, setState)
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
  }, [])

  const selectSize = useCallback((size: string) => {
    setState((prev) => {
      if (prev.status !== 'selecting_size' || !prev.storagePath || !prev.fileName) return prev
      runExtraction(prev.storagePath, size, prev.fileName, setState)
      return {
        ...prev,
        status: 'extracting' as const,
        selectedSize: size,
      }
    })
  }, [])

  const dismiss = useCallback(() => {
    setState(initialState)
  }, [])

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
