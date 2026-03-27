import React from 'react'
import type { RepoStatus } from '../types/atom'

interface SyncStatusProps {
  statuses: Map<string, RepoStatus>
  onClick: () => void
}

export default function SyncStatus({ statuses, onClick }: SyncStatusProps) {
  const isSyncing = Array.from(statuses.values()).some(
    s => s.state === 'syncing' || s.state === 'fetching'
  )

  return (
    <div className="h-6 px-2 bg-gray-800 border-t border-gray-700 flex items-center justify-end flex-shrink-0">
      <button
        onClick={onClick}
        className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-xs transition-colors hover:bg-gray-700 ${
          isSyncing ? 'text-blue-400' : 'text-gray-400 hover:text-gray-300'
        }`}
      >
        {isSyncing && (
          <span className="w-3 h-3 flex-shrink-0 animate-pulse">
            <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeDasharray="28" strokeDashoffset="8" strokeLinecap="round" />
            </svg>
          </span>
        )}
        {isSyncing ? 'Syncing\u2026' : 'Synced'}
      </button>
    </div>
  )
}
