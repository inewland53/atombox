import React from 'react'

interface EmptyStateProps {
  progress: { loaded: number; total: number } | null
}

export default function EmptyState({ progress }: EmptyStateProps) {
  const pct = progress && progress.total > 0
    ? Math.round((progress.loaded / progress.total) * 100)
    : 0

  return (
    <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
      <svg className="animate-spin w-8 h-8 text-blue-500 mb-4" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" strokeDasharray="50" strokeDashoffset="15" strokeLinecap="round" />
      </svg>
      <div className="text-lg mb-2">Syncing Reactor catalog…</div>
      <div className="text-sm text-gray-500">
        {progress
          ? `${progress.loaded} / ${progress.total} atoms`
          : 'Connecting…'}
      </div>
      <div className="mt-4 w-48 h-1.5 bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-600 rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
