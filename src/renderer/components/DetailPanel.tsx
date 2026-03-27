import React, { useEffect, useMemo, useState } from 'react'
import DOMPurify from 'dompurify'
import type { Atom, InstalledMap } from '../types/atom'
import { compareVersions } from '../../main/services/atomParser'
import { useInstallAtom, useUninstallAtom, useInstallProgress } from '../hooks/useInstallAtom'

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

interface Props { atom: Atom; installed: InstalledMap; onClose: () => void }

export default function DetailPanel({ atom, installed, onClose }: Props) {
  const [imgError, setImgError] = useState(false)
  const sanitizedDescription = useMemo(() => DOMPurify.sanitize(atom.description), [atom.description])
  const types = useMemo(() => getAtomTypes(atom.deployFiles), [atom.deployFiles])
  const [progress, setProgress] = useState<{ index: number; total: number } | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const installMutation = useInstallAtom()
  const uninstallMutation = useUninstallAtom()

  useEffect(() => {
    if (installMutation.isSuccess) {
      setProgress(null)
      showToast('Restart DaVinci Resolve to use the newly installed atom.')
    }
  }, [installMutation.isSuccess])

  useEffect(() => {
    if (uninstallMutation.isSuccess) {
      showToast('Restart DaVinci Resolve for the uninstall to take effect.')
    }
  }, [uninstallMutation.isSuccess])

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const record = installed[atom.id]
  const hasUpdate = record && compareVersions(atom.version, record.version) > 0
  const isPending = installMutation.isPending || uninstallMutation.isPending
  const error = installMutation.error ?? uninstallMutation.error

  useInstallProgress((p) => {
    if (p.atomId === atom.id) setProgress({ index: p.index + 1, total: p.total })
  })

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 6000)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="bg-gray-800 border border-gray-700 rounded-lg w-full max-w-5xl max-h-[80vh] flex flex-col overflow-hidden mx-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 flex-shrink-0">
          <span className="font-semibold text-sm truncate">{atom.name}</span>
          <button onClick={onClose} className="text-gray-400 hover:text-white ml-2">&#10005;</button>
        </div>

        {/* Two-column body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left: image + metadata + actions */}
          <div className="w-56 flex-shrink-0 border-r border-gray-700 flex flex-col">
            <div className="h-40 bg-gray-700 flex items-center justify-center flex-shrink-0">
              {!imgError
                ? <img src={atom.thumbnailUrl} alt="" className="w-full h-full object-contain" onError={() => setImgError(true)} />
                : <div className="text-5xl text-gray-500">&#128230;</div>
              }
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <div><div className="text-xs text-gray-400">Author</div><div className="text-sm">{atom.author}</div></div>
              <div>
                <div className="text-xs text-gray-400">Version</div>
                <div className="text-sm">{atom.version}{record && ` (installed: ${record.version})`}</div>
              </div>
              <div><div className="text-xs text-gray-400">Category</div><div className="text-sm">{atom.category}</div></div>
              {types.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {types.map(t => (
                    <span key={t} className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium leading-none ${PILL_COLORS[t] ?? DEFAULT_PILL}`}>
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-700 space-y-2 flex-shrink-0">
              {toast && (
                <div className="text-xs text-yellow-300 bg-yellow-900/40 border border-yellow-700 rounded px-2 py-1.5">
                  {toast}
                </div>
              )}
              {error && <div className="text-xs text-red-400">{(error as Error).message}</div>}
              {isPending && progress && (
                <div className="text-xs text-gray-400">Installing {progress.index}/{progress.total} files...</div>
              )}

              {!record && (
                <button onClick={() => installMutation.mutate(atom)}
                  disabled={isPending || !atom.hasFilesForPlatform}
                  title={!atom.hasFilesForPlatform ? 'Not available for this platform' : undefined}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded text-sm">
                  {isPending ? 'Installing...' : 'Install'}
                </button>
              )}
              {record && hasUpdate && (
                <button onClick={() => installMutation.mutate(atom)} disabled={isPending}
                  className="w-full py-2 bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 rounded text-sm">
                  {isPending ? 'Updating...' : 'Update'}
                </button>
              )}
              {record && (
                <button onClick={() => uninstallMutation.mutate(atom.id)} disabled={isPending}
                  className="group w-full py-2 bg-gray-700 hover:bg-red-800 disabled:opacity-50 rounded text-sm text-gray-300">
                  {isPending ? 'Removing...' : 'Uninstall'}
                </button>
              )}
              {!atom.hasFilesForPlatform && (
                <div className="text-xs text-yellow-500">Not available for this platform</div>
              )}
              <a href={atom.gitlabUrl} target="_blank" rel="noreferrer"
                className="w-full py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm text-gray-300 text-center block">
                View on GitLab ↗
              </a>
            </div>
          </div>

          {/* Right: description */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="text-xs text-gray-400 uppercase tracking-wide mb-3">Description</div>
            <div
              className="text-sm text-gray-300 [&_a]:text-blue-400 [&_a]:underline leading-relaxed"
              dangerouslySetInnerHTML={{ __html: sanitizedDescription }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
