'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth/AuthContext'
import { useUpload } from '@/lib/upload/UploadContext'
import { Card } from '@/app/components/ui/Card'
import { Button } from '@/app/components/ui/Button'
import { TodayStamp } from '@/app/components/ui/TodayStamp'
import {
  CheckIcon,
  CloseIcon,
  CloudUploadIcon,
  FileIcon,
} from '@/app/components/ui/icons'

const STEPS = ['Select file', 'Detect sizes', 'Process AI']

function Spinner({ className = '' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  )
}

/** Horizontal progress rail: numbered discs joined by hairlines. */
function Stepper({ active }: { active: number }) {
  return (
    <ol className="mx-auto mt-14 flex max-w-2xl items-start">
      {STEPS.map((label, i) => {
        const step = i + 1
        const done = step < active
        const current = step === active

        return (
          <li key={label} className="flex flex-1 flex-col items-center">
            <div className="flex w-full items-center">
              <span className={`h-px flex-1 ${i === 0 ? 'bg-transparent' : 'bg-line-strong'}`} />
              <span
                className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full font-display text-2xl ring-[6px] ring-surface ${
                  done || current ? 'bg-sage text-parchment' : 'bg-sand-soft text-ink-soft'
                }`}
              >
                {done ? <CheckIcon className="h-6 w-6" /> : step}
              </span>
              <span
                className={`h-px flex-1 ${
                  i === STEPS.length - 1 ? 'bg-transparent' : 'bg-line-strong'
                }`}
              />
            </div>
            <span
              className={`eyebrow mt-4 text-center ${done || current ? 'text-ink' : 'text-ink-soft'}`}
            >
              {label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

export default function UploadPatternPage() {
  const { user } = useAuth()
  const router = useRouter()
  const upload = useUpload()
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)

  // Auto-redirect on successful upload while still on this page
  useEffect(() => {
    if (upload.status === 'success' && upload.patternId) {
      const timer = setTimeout(() => {
        router.push(`/patterns/${upload.patternId}`)
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [upload.status, upload.patternId, router])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      if (selectedFile.type !== 'application/pdf') {
        setFileError('Please select a PDF file')
        setFile(null)
        return
      }
      setFile(selectedFile)
      setFileError(null)
    }
  }

  const handleRemoveFile = () => {
    setFile(null)
    setFileError(null)
  }

  const handleUpload = () => {
    if (!file || !user) return
    upload.startUpload(file)
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <Card className="max-w-md p-8 text-center">
          <p className="text-ink-muted">Please sign in to upload patterns</p>
          <Button
            variant="primary"
            className="mt-5 w-full"
            onClick={() => router.push('/auth/login')}
          >
            Sign In
          </Button>
        </Card>
      </div>
    )
  }

  const isUploading = upload.status === 'uploading'
  const isSelectingSize = upload.status === 'selecting_size'
  const isExtracting = upload.status === 'extracting'
  const isSuccess = upload.status === 'success'
  const isBusy = isUploading || isExtracting

  // Three phases: pick the file, detect its sizes, then extract for the chosen one.
  const activeStep = isSuccess || isExtracting ? 3 : isUploading || isSelectingSize ? 2 : 1

  const copy = isSuccess
    ? { title: 'Your pattern is ready', body: 'Taking you to it now.' }
    : isExtracting
      ? {
          title: 'Processing with AI',
          body: 'This usually takes 30–60 seconds. You can leave this page — it will keep going and be here when you get back.',
        }
      : isSelectingSize
        ? {
            title: 'Choose your size',
            body: 'Instructions are extracted with every value resolved for your size — no more counting parentheses.',
          }
        : isUploading
          ? { title: 'Detecting sizes', body: 'Scanning your pattern to find the sizes it offers.' }
          : file
            ? { title: 'Ready to upload', body: 'We’ll scan this pattern to find its available sizes.' }
            : {
                title: 'Select your PDF pattern',
                body: 'Upload a PDF pattern and we’ll extract the instructions for your chosen size.',
              }

  return (
    <main className="mx-auto max-w-5xl px-6 py-12 sm:px-10 lg:px-14 lg:py-16">
      {/* Header */}
      <section className="flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <p className="mb-7 flex items-center gap-4 text-sage-deep">
            <span className="h-px w-10 bg-sage-deep" aria-hidden="true" />
            <span className="eyebrow">Pattern library</span>
          </p>
          <h1 className="font-display text-4xl leading-[1.05] tracking-[-0.02em] text-ink sm:text-5xl">
            Upload Knitting Pattern
          </h1>
        </div>

        <div className="flex shrink-0 items-start gap-6 lg:flex-col lg:items-end lg:gap-5 lg:pt-2">
          <TodayStamp />
          <Link
            href="/patterns"
            aria-label="Cancel and go back to your patterns"
            title="Cancel"
            className="flex h-14 w-14 items-center justify-center rounded-full bg-surface text-ink shadow-[0_1px_2px_rgba(28,26,23,0.05),0_10px_30px_-12px_rgba(28,26,23,0.3)] transition-colors hover:bg-ink hover:text-parchment"
          >
            <CloseIcon className="h-5 w-5" />
          </Link>
        </div>
      </section>

      <Stepper active={activeStep} />

      {fileError && (
        <div className="mx-auto mt-10 max-w-2xl rounded-2xl border border-clay-soft bg-clay-soft px-5 py-4 text-center">
          <p className="text-sm font-medium text-clay">{fileError}</p>
        </div>
      )}

      {/* The one card, whose contents follow the active step */}
      <Card className="mt-12 rounded-[2rem] p-8 text-center sm:p-14">
        <h2 className="font-display text-4xl tracking-tight text-ink">{copy.title}</h2>
        <p className="mx-auto mt-4 max-w-xl text-ink-muted">{copy.body}</p>

        {/* Step 1 — no file yet */}
        {!file && !isBusy && !isSelectingSize && !isSuccess && (
          <>
            <input
              type="file"
              id="pdf-upload"
              accept="application/pdf"
              onChange={handleFileChange}
              className="hidden"
            />
            <label
              htmlFor="pdf-upload"
              className="mt-10 flex cursor-pointer flex-col items-center rounded-[1.75rem] border-2 border-dashed border-line-strong px-6 py-14 transition-colors hover:border-sage hover:bg-sage-soft/30"
            >
              <span className="flex h-24 w-24 items-center justify-center rounded-full bg-surface text-sage-deep shadow-[0_1px_2px_rgba(28,26,23,0.05),0_14px_36px_-18px_rgba(28,26,23,0.4)]">
                <CloudUploadIcon className="h-9 w-9" />
              </span>
              <span className="mt-7 text-lg font-medium text-ink">Click to select PDF</span>
              <span className="mt-1 text-sm text-ink-soft">
                Any knitting pattern in PDF format
              </span>
            </label>
          </>
        )}

        {/* Step 1 — file chosen, ready to send */}
        {file && !isBusy && !isSelectingSize && !isSuccess && (
          <div className="mx-auto mt-10 max-w-xl">
            <div className="flex items-center justify-between gap-4 rounded-2xl bg-parchment px-5 py-4 text-left">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sage-soft text-sage-deep">
                  <FileIcon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">{file.name}</p>
                  <p className="text-sm text-ink-soft">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
              <button
                onClick={handleRemoveFile}
                className="shrink-0 rounded-full px-3 py-1 text-sm text-ink-soft transition-colors hover:text-ink"
              >
                Change
              </button>
            </div>

            <Button
              variant="primary"
              size="lg"
              className="mt-6 w-full"
              onClick={handleUpload}
              disabled={isBusy}
            >
              Upload Pattern
            </Button>
          </div>
        )}

        {/* Step 2 — choosing a size */}
        {isSelectingSize && upload.sizes && (
          <div className="mx-auto mt-10 grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {upload.sizes.map((size) => (
              <button
                key={size}
                onClick={() => upload.selectSize(size)}
                className="rounded-2xl border border-line-strong px-4 py-3.5 font-medium text-ink transition-colors hover:border-sage hover:bg-sage-soft"
              >
                {size}
              </button>
            ))}
          </div>
        )}

        {/* Working states */}
        {isBusy && (
          <div className="mt-10 flex items-center justify-center gap-3 text-sage-deep">
            <Spinner className="h-5 w-5" />
            <span className="text-sm font-medium">
              {isUploading
                ? 'Uploading and detecting sizes…'
                : `Extracting${upload.selectedSize ? ` size ${upload.selectedSize}` : ''}…`}
            </span>
          </div>
        )}

        {isSuccess && (
          <div className="mt-10 inline-flex items-center gap-3 rounded-full bg-sage-soft px-5 py-3 text-sage-deep">
            <CheckIcon className="h-5 w-5" />
            <span className="text-sm font-medium">Pattern uploaded and processed</span>
          </div>
        )}
      </Card>

      {/* Tips */}
      <section className="mt-8 rounded-[2rem] border border-line bg-sage-soft/50 p-8 sm:p-10">
        <h3 className="font-display text-2xl tracking-tight text-ink">Tips for best results</h3>
        <ul className="mt-4 space-y-2 text-ink-muted">
          {[
            'Use clear, well-formatted PDF patterns',
            'Patterns with standard knitting abbreviations work best',
            'Charts, colorwork, and multi-size patterns are all supported',
            'After choosing your size, all stitch counts are resolved for you',
          ].map((tip) => (
            <li key={tip} className="flex items-start gap-3">
              <CheckIcon className="mt-1 h-4 w-4 shrink-0 text-sage-deep" />
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
