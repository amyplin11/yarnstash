'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/AuthContext'
import { useUpload } from '@/lib/upload/UploadContext'
import { Card } from '@/app/components/ui/Card'
import { Button } from '@/app/components/ui/Button'

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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-8 max-w-md">
          <p className="text-foreground/70 text-center">
            Please sign in to upload patterns
          </p>
          <Button
            variant="primary"
            className="w-full mt-4"
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

  // Step tracking: 1=select file, 2=upload & detect sizes, 3=choose size, 4=view
  const currentStep = isSuccess
    ? 4
    : isExtracting
    ? 3
    : isSelectingSize
    ? 3
    : file
    ? 2
    : 1

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">
            Upload Knitting Pattern
          </h1>
          <p className="text-foreground/70">
            Upload a PDF pattern and we&apos;ll extract the instructions for your chosen size
          </p>
        </div>

        {/* File Validation Error */}
        {fileError && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-800 dark:text-red-300">{fileError}</p>
          </div>
        )}

        {/* Step 1: Select PDF */}
        <Card className={`p-6 mb-4 transition-all ${currentStep === 1 ? 'ring-2 ring-teal-500' : ''}`}>
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
              currentStep > 1
                ? 'bg-teal-600 text-white'
                : 'bg-teal-100 dark:bg-teal-900 text-teal-700 dark:text-teal-300'
            }`}>
              {currentStep > 1 ? '\u2713' : '1'}
            </div>
            <h2 className="text-lg font-semibold text-foreground">
              Select your PDF pattern
            </h2>
          </div>

          {!file ? (
            <div className="border-2 border-dashed border-foreground/20 rounded-lg p-8 text-center">
              <input
                type="file"
                id="pdf-upload"
                accept="application/pdf"
                onChange={handleFileChange}
                className="hidden"
                disabled={isBusy}
              />
              <label
                htmlFor="pdf-upload"
                className="cursor-pointer flex flex-col items-center"
              >
                <div className="w-16 h-16 rounded-full bg-teal-50 dark:bg-teal-950/30 flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-teal-600 dark:text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <p className="text-lg font-medium text-foreground mb-1">
                  Click to select PDF
                </p>
                <p className="text-sm text-foreground/50">
                  Any knitting pattern in PDF format
                </p>
              </label>
            </div>
          ) : (
            <div className="flex items-center justify-between p-4 bg-teal-50 dark:bg-teal-950/20 rounded-lg">
              <div className="flex items-center gap-3">
                <svg className="w-8 h-8 text-teal-600 dark:text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <div>
                  <p className="font-medium text-foreground">{file.name}</p>
                  <p className="text-sm text-foreground/60">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
              {!isBusy && !isSuccess && !isSelectingSize && (
                <button
                  onClick={handleRemoveFile}
                  className="text-sm text-foreground/50 hover:text-foreground transition-colors px-3 py-1 rounded"
                >
                  Change
                </button>
              )}
            </div>
          )}
        </Card>

        {/* Step 2: Upload & Detect Sizes */}
        <Card className={`p-6 mb-4 transition-all ${
          currentStep === 2 ? 'ring-2 ring-teal-500' : ''
        } ${currentStep < 2 ? 'opacity-50' : ''}`}>
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
              currentStep > 2
                ? 'bg-teal-600 text-white'
                : currentStep === 2
                ? 'bg-teal-100 dark:bg-teal-900 text-teal-700 dark:text-teal-300'
                : 'bg-foreground/10 text-foreground/40'
            }`}>
              {currentStep > 2 ? '\u2713' : '2'}
            </div>
            <h2 className="text-lg font-semibold text-foreground">
              Upload & detect sizes
            </h2>
          </div>

          <p className="text-sm text-foreground/70 mb-4">
            We&apos;ll scan your pattern to find the available sizes so you can choose yours.
          </p>

          {isUploading ? (
            <div className="text-center py-4">
              <div className="inline-flex items-center gap-3 px-6 py-3 bg-teal-50 dark:bg-teal-950/20 rounded-lg">
                <svg className="w-5 h-5 text-teal-600 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="text-sm font-medium text-teal-700 dark:text-teal-300">
                  Uploading and detecting sizes...
                </span>
              </div>
            </div>
          ) : currentStep === 2 ? (
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              onClick={handleUpload}
              disabled={!file || isBusy}
            >
              Upload Pattern
            </Button>
          ) : null}
        </Card>

        {/* Step 3: Choose Size / Process */}
        <Card className={`p-6 mb-4 transition-all ${
          currentStep === 3 ? 'ring-2 ring-teal-500' : ''
        } ${currentStep < 3 ? 'opacity-50' : ''}`}>
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
              currentStep > 3
                ? 'bg-teal-600 text-white'
                : currentStep === 3
                ? 'bg-teal-100 dark:bg-teal-900 text-teal-700 dark:text-teal-300'
                : 'bg-foreground/10 text-foreground/40'
            }`}>
              {currentStep > 3 ? '\u2713' : '3'}
            </div>
            <h2 className="text-lg font-semibold text-foreground">
              {isSelectingSize ? 'Choose your size' : 'Process with AI'}
            </h2>
          </div>

          {isSelectingSize && upload.sizes && (
            <>
              <p className="text-sm text-foreground/70 mb-4">
                Select the size you want to make. Instructions will be extracted with all values resolved for your size — no more counting parentheses!
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {upload.sizes.map((size) => (
                  <button
                    key={size}
                    onClick={() => upload.selectSize(size)}
                    className="px-4 py-3 rounded-lg border-2 border-foreground/15 hover:border-teal-500 hover:bg-teal-50 dark:hover:bg-teal-950/20 text-foreground font-medium transition-all text-center"
                  >
                    {size}
                  </button>
                ))}
              </div>
            </>
          )}

          {isExtracting && (
            <div className="text-center py-4">
              <div className="inline-flex items-center gap-3 px-6 py-3 bg-teal-50 dark:bg-teal-950/20 rounded-lg">
                <svg className="w-5 h-5 text-teal-600 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="text-sm font-medium text-teal-700 dark:text-teal-300">
                  Extracting pattern for size {upload.selectedSize}... this may take 30-60 seconds
                </span>
              </div>
            </div>
          )}

          {currentStep < 3 && (
            <p className="text-sm text-foreground/50">
              Upload your pattern first to see available sizes.
            </p>
          )}
        </Card>

        {/* Step 4: Success */}
        <Card className={`p-6 mb-4 transition-all ${
          currentStep === 4 ? 'ring-2 ring-teal-500' : 'opacity-50'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
              currentStep === 4
                ? 'bg-teal-600 text-white'
                : 'bg-foreground/10 text-foreground/40'
            }`}>
              {currentStep === 4 ? '\u2713' : '4'}
            </div>
            <h2 className="text-lg font-semibold text-foreground">
              View your pattern
            </h2>
          </div>

          {isSuccess && (
            <div className="mt-4 p-4 bg-green-50 dark:bg-green-950/20 rounded-lg">
              <p className="font-medium text-green-800 dark:text-green-300">
                Pattern uploaded and processed successfully!
              </p>
              <p className="text-sm text-green-700 dark:text-green-400 mt-1">
                Redirecting to your pattern...
              </p>
            </div>
          )}
        </Card>

        {/* Tips */}
        <Card className="p-6 mt-6 bg-teal-50 dark:bg-teal-950/20 border-teal-200 dark:border-teal-800">
          <h3 className="font-semibold text-foreground mb-2">Tips for best results</h3>
          <ul className="text-sm text-foreground/80 space-y-1 list-disc list-inside">
            <li>Use clear, well-formatted PDF patterns</li>
            <li>Patterns with standard knitting abbreviations work best</li>
            <li>Charts, colorwork, and multi-size patterns are all supported</li>
            <li>After choosing your size, all stitch counts will be resolved — no more guessing!</li>
          </ul>
        </Card>
      </main>
    </div>
  )
}
