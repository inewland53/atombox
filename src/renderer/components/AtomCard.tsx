import React, { useMemo, useRef, useState } from 'react'
import type { Atom, InstalledMap } from '../types/atom'
import { compareVersions } from '../../main/services/atomParser'
import { useInstallAtom, useUninstallAtom } from '../hooks/useInstallAtom'

const PILL_COLORS: Record<string, string> = {
  Fuse: 'bg-purple-700 text-purple-200',
  Macro: 'bg-green-700 text-green-200',
  Script: 'bg-orange-700 text-orange-200',
  Comp: 'bg-cyan-700 text-cyan-200',
  Template: 'bg-pink-700 text-pink-200',
  Plugin: 'bg-red-700 text-red-200',
}
const DEFAULT_PILL = 'bg-gray-600 text-gray-300'

function getAtomTypes(deployFiles: string[]): string[] {
  const types = new Set<string>()
  for (const f of deployFiles) {
    const dir = f.split('/')[0]
    if (dir) types.add(dir.replace(/s$/, ''))
  }
  return [...types].filter(t => ['Fuse', 'Macro', 'Script', 'Comp', 'Template', 'Plugin'].includes(t))
}

interface Props {
  atom: Atom
  installed: InstalledMap
  isSelected: boolean
  onClick: () => void
  showSourceBadge?: boolean
}

export default function AtomCard({ atom, installed, isSelected, onClick, showSourceBadge }: Props) {
  const [imgError, setImgError] = useState(false)
  const [showTooltip, setShowTooltip] = useState(false)
  const tooltipTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const installMutation = useInstallAtom()
  const uninstallMutation = useUninstallAtom()
  const record = installed[atom.id]
  const hasUpdate = record && compareVersions(atom.version, record.version) > 0
  const status = record ? (hasUpdate ? 'update' : 'installed') : 'none'
  const isPending = installMutation.isPending || uninstallMutation.isPending
  const types = useMemo(() => getAtomTypes(atom.deployFiles), [atom.deployFiles])
  const snippet = useMemo(() => {
    const doc = new DOMParser().parseFromString(atom.description, 'text/html')
    return (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim()
  }, [atom.description])

  function handleAction(e: React.MouseEvent) {
    e.stopPropagation()
    if (status === 'none' || status === 'update') installMutation.mutate(atom)
    else uninstallMutation.mutate(atom.id)
  }

  return (
    <div onClick={onClick}
      className={`bg-gray-800 rounded-lg overflow-hidden cursor-pointer border-2 transition-colors flex flex-col ${isSelected ? 'border-blue-500' : 'border-transparent hover:border-gray-600'}`}>
      <div className="relative h-28 bg-gray-700 flex items-center justify-center overflow-hidden">
        {!imgError
          ? <img src={atom.thumbnailUrl} alt="" className="w-full h-full object-cover" onError={() => setImgError(true)} />
          : <div className="text-4xl text-gray-500">&#128230;</div>
        }
        {showSourceBadge && (
          <span className="absolute top-1.5 left-1.5 bg-black/60 text-gray-200 text-[9px] px-1.5 py-0.5 rounded-full leading-none">
            {atom.sourceName.length > 12 ? atom.sourceName.slice(0, 12) : atom.sourceName}
          </span>
        )}
        {types.length > 0 && (
          <div className="absolute bottom-1.5 right-1.5 flex gap-1">
            {types.map(t => (
              <span key={t} className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium leading-none ${PILL_COLORS[t] ?? DEFAULT_PILL}`}>
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="p-3 flex flex-col flex-1">
        <div className="relative"
          onMouseEnter={() => { tooltipTimer.current = setTimeout(() => setShowTooltip(true), 1000) }}
          onMouseLeave={() => { if (tooltipTimer.current) clearTimeout(tooltipTimer.current); setShowTooltip(false) }}>
          <div className="text-xs font-medium text-gray-100 truncate">{atom.name}</div>
          {showTooltip && (
            <div className="absolute z-50 left-0 top-full mt-1 bg-gray-900 border border-gray-600 text-gray-100 text-xs rounded px-2 py-1.5 shadow-lg max-w-xs whitespace-normal pointer-events-none">
              {atom.name}
            </div>
          )}
        </div>
        <div className="text-xs text-gray-400 truncate mt-1">{atom.author}</div>
        {snippet && <p className="text-xs text-gray-500 mt-1.5 mb-2 line-clamp-5">{snippet}</p>}
        <button onClick={handleAction} disabled={isPending || !atom.hasFilesForPlatform}
          title={!atom.hasFilesForPlatform ? 'Not available for this platform' : undefined}
          className={`group mt-auto pt-2 w-full text-xs py-1 rounded transition-colors disabled:opacity-50 ${
            status === 'update' ? 'bg-yellow-600 hover:bg-yellow-500 text-white' :
            status === 'installed' ? 'bg-gray-600 hover:bg-red-700 text-gray-200' :
            'bg-blue-600 hover:bg-blue-500 text-white'
          }`}>
          {isPending ? '...' : status === 'update' ? 'Update' : status === 'installed' ? <><span className="group-hover:hidden">Installed</span><span className="hidden group-hover:inline">Uninstall</span></> : 'Install'}
        </button>
      </div>
    </div>
  )
}
