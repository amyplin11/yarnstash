'use client'

import Link from 'next/link'
import { useUpload } from '@/lib/upload/UploadContext'

export function UploadStatusBar() {
  const { status, fileName, patternId, patternName, selectedSize, error, warnings, dismiss } = useUpload()

  if (status === 'idle') return null

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm w-full animate-in slide-in-from-bottom-4">
      {status === 'uploading' && (
        <div className="bg-teal-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3">
          <svg className="w-5 h-5 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-sm font-medium truncate">
            Uploading {fileName}...
          </span>
        </div>
      )}

      {status === 'selecting_size' && (
        <div className="bg-teal-600 text-white px-4 py-3 rounded-lg shadow-lg">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium truncate">
              Choose a size for {fileName}
            </span>
            <Link
              href="/patterns/upload"
              className="text-sm font-medium underline underline-offset-2 hover:no-underline flex-shrink-0"
            >
              Select
            </Link>
          </div>
        </div>
      )}

      {status === 'extracting' && (
        <div className="bg-teal-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3">
          <svg className="w-5 h-5 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-sm font-medium truncate">
            Processing {fileName}{selectedSize ? ` (${selectedSize})` : ''}...
          </span>
        </div>
      )}

      {status === 'success' && (
        <div className={`${warnings?.length ? 'bg-amber-600' : 'bg-green-600'} text-white px-4 py-3 rounded-lg shadow-lg`}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {warnings?.length ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                )}
              </svg>
              <span className="text-sm font-medium truncate">
                {warnings?.length ? `${patternName} uploaded with warnings` : `${patternName} uploaded!`}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {patternId && (
                <Link
                  href={`/patterns/${patternId}`}
                  onClick={dismiss}
                  className="text-sm font-medium underline underline-offset-2 hover:no-underline"
                >
                  View
                </Link>
              )}
              <button
                onClick={dismiss}
                className={`p-1 rounded ${warnings?.length ? 'hover:bg-amber-700' : 'hover:bg-green-700'} transition-colors`}
                aria-label="Dismiss"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          {warnings?.map((w, i) => (
            <p key={i} className="text-xs mt-1 opacity-90">{w}</p>
          ))}
        </div>
      )}

      {status === 'error' && (
        <div className="bg-red-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-medium truncate">
              Upload failed: {error}
            </span>
          </div>
          <button
            onClick={dismiss}
            className="flex-shrink-0 p-1 rounded hover:bg-red-700 transition-colors"
            aria-label="Dismiss"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}
