import React from 'react'
import type { StatusFilter } from '../App'
import type { RepoSource } from '../types/atom'

export type TypeFilter = 'Fuse' | 'Script' | 'Macro' | 'Comp' | 'Template' | 'Plugin' | 'Misc' | null

interface Props {
  activeType: TypeFilter
  activeStatus: StatusFilter
  onTypeChange: (t: TypeFilter) => void
  onStatusChange: (s: StatusFilter) => void
  onSettingsClick: () => void
  repos: RepoSource[]
  activeSource: string | null
  onSourceChange: (s: string | null) => void
}

const STATUS_ITEMS: { label: string; value: StatusFilter; icon: string }[] = [
  { label: 'All', value: 'all', icon: '⊞' },
  { label: 'Installed', value: 'installed', icon: '✓' },
  { label: 'Updates', value: 'updates', icon: '↑' },
]

const TYPE_ITEMS: { label: string; value: TypeFilter; icon: string }[] = [
  { label: 'Fuse', value: 'Fuse', icon: '⚡' },
  { label: 'Script', value: 'Script', icon: '📜' },
  { label: 'Macro', value: 'Macro', icon: '⚙' },
  { label: 'Comp', value: 'Comp', icon: '🎬' },
  { label: 'Template', value: 'Template', icon: '📐' },
  { label: 'Plugin', value: 'Plugin', icon: '🔌' },
  { label: 'Misc', value: 'Misc', icon: '📦' },
]

export default function Sidebar({ activeType, activeStatus, onTypeChange, onStatusChange, onSettingsClick, repos, activeSource, onSourceChange }: Props) {
  const showSources = repos.length > 1
  const uniqueLabels = showSources
    ? [...new Set(repos.map(r => r.categoryLabel).filter(Boolean))]
    : []

  return (
    <div className="w-48 flex-shrink-0 bg-gray-800 flex flex-col h-full">
      <div className="p-3 font-bold text-sm text-gray-400 uppercase tracking-wider">AtomBox</div>
      <nav className="flex-1 overflow-y-auto">
        {STATUS_ITEMS.map(item => (
          <button key={item.value} onClick={() => { onStatusChange(item.value); onTypeChange(null) }}
            className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 ${
              activeStatus === item.value && activeType === null ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700'
            }`}>
            <span className="w-4 text-center">{item.icon}</span>
            {item.label}
          </button>
        ))}

        <div className="mx-4 my-3 border-t border-gray-700" />

        <div className="px-4 py-2 text-xs text-gray-500 uppercase tracking-wider">Category</div>
        {TYPE_ITEMS.map(item => (
          <button key={item.value} onClick={() => { onTypeChange(item.value); onStatusChange('all') }}
            className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 ${
              activeType === item.value ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700'
            }`}>
            <span className="w-4 text-center">{item.icon}</span>
            {item.label}
          </button>
        ))}

        {showSources && (
          <>
            <div className="mx-4 my-3 border-t border-gray-700" />
            <div className="px-4 py-2 text-xs text-gray-500 uppercase tracking-wider">Sources</div>
            <button
              onClick={() => onSourceChange(null)}
              className={`w-full text-left px-4 py-2 text-sm ${activeSource === null ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}>
              All Sources
            </button>
            {uniqueLabels.map(label => (
              <button key={label} onClick={() => onSourceChange(label)}
                className={`w-full text-left px-4 py-2 text-sm ${activeSource === label ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}>
                {label}
              </button>
            ))}
          </>
        )}
      </nav>
      <button onClick={onSettingsClick} className="p-4 text-sm text-gray-400 hover:text-white text-left flex items-center gap-2">
        <span className="w-4 text-center">⚙</span>
        Settings
      </button>
    </div>
  )
}
