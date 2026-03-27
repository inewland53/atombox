import React, { useState, useMemo, useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAtoms } from './hooks/useAtoms'
import { useInstalled } from './hooks/useInstalled'
import { useRepos } from './hooks/useRepos'
import { useRepoStatus } from './hooks/useRepoStatus'
import { compareVersions } from '../main/services/atomParser'
import Sidebar from './components/Sidebar'
import type { TypeFilter } from './components/Sidebar'
import SearchBar from './components/SearchBar'
import AtomGrid from './components/AtomGrid'
import DetailPanel from './components/DetailPanel'
import Settings from './components/Settings'
import SyncStatus from './components/StatusBar'
import EmptyState from './components/EmptyState'
import type { Atom } from './types/atom'

export type StatusFilter = 'all' | 'installed' | 'updates'

const TYPE_DIRS: Record<string, string> = {
  Fuse: 'Fuses',
  Script: 'Scripts',
  Macro: 'Macros',
  Comp: 'Comps',
  Template: 'Templates',
  Plugin: 'Plugins',
}

function atomMatchesType(atom: Atom, type: TypeFilter): boolean {
  if (!type) return true
  if (type === 'Misc') {
    const knownDirs = new Set(Object.values(TYPE_DIRS))
    return atom.deployFiles.every(f => {
      const dir = f.split('/')[0]
      return !knownDirs.has(dir)
    })
  }
  const dir = TYPE_DIRS[type]
  return atom.deployFiles.some(f => f.startsWith(dir + '/'))
}

export default function App() {
  const { data: atoms = [], atomsBySource, refresh } = useAtoms()
  const { data: installed = {} } = useInstalled()
  const queryClient = useQueryClient()
  const { repos } = useRepos()
  const { statuses, fetchRepo, syncRepo, syncAll } = useRepoStatus()
  const detectedRef = useRef(false)

  // Wait for Reactor to finish syncing before detecting installed atoms,
  // so we check the full catalog rather than just the first batch
  const reactorStatus = statuses.get('builtin-reactor')
  useEffect(() => {
    if (reactorStatus?.state === 'synced' && atoms.length > 0 && !detectedRef.current) {
      detectedRef.current = true
      window.api.detectInstalled(atoms).then(() => {
        queryClient.invalidateQueries({ queryKey: ['installed'] })
      })
    }
  }, [reactorStatus?.state, atoms, queryClient])
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [selected, setSelected] = useState<Atom | null>(null)
  const [showSettings, setShowSettings] = useState<false | string>(false)
  const [sourceFilter, setSourceFilter] = useState<string | null>(null)

  const isFirstLaunch = atoms.length === 0 && (!reactorStatus || reactorStatus.state === 'syncing')
  const gridResetKey = `${search}|${typeFilter}|${statusFilter}|${sourceFilter}`

  const filtered = useMemo(() => {
    const matchingRepoIds = sourceFilter !== null
      ? new Set(repos.filter(r => r.categoryLabel === sourceFilter).map(r => r.id))
      : null
    return atoms.filter(atom => {
      if (search && !atom.name.toLowerCase().includes(search.toLowerCase()) &&
          !atom.author.toLowerCase().includes(search.toLowerCase())) return false
      if (!atomMatchesType(atom, typeFilter)) return false
      if (statusFilter === 'installed' && !installed[atom.id]) return false
      if (statusFilter === 'updates') {
        const rec = installed[atom.id]
        if (!rec || compareVersions(atom.version, rec.version) <= 0) return false
      }
      if (matchingRepoIds !== null && !matchingRepoIds.has(atom.sourceId)) return false
      return true
    })
  }, [atoms, search, typeFilter, statusFilter, installed, sourceFilter, repos])

  if (showSettings) return <Settings onBack={() => setShowSettings(false)} onRefresh={refresh} statuses={statuses} onFetch={fetchRepo} onSync={syncRepo} initialTab={showSettings || undefined} />

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-gray-100 overflow-hidden">
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          activeType={typeFilter}
          activeStatus={statusFilter}
          onTypeChange={setTypeFilter}
          onStatusChange={setStatusFilter}
          onSettingsClick={() => setShowSettings('general')}
          repos={repos}
          activeSource={sourceFilter}
          onSourceChange={setSourceFilter}
        />
        <div className="flex flex-col flex-1 overflow-hidden">
          <SearchBar value={search} onChange={setSearch} />
          {isFirstLaunch
            ? <EmptyState progress={reactorStatus?.progress ?? null} />
            : <AtomGrid atoms={filtered} installed={installed} selected={selected} heading={typeFilter ?? (statusFilter === 'installed' ? 'Installed' : statusFilter === 'updates' ? 'Updates' : 'All')} onSelect={setSelected} showSourceBadge={repos.length > 1} resetKey={gridResetKey} />
          }
        </div>
        {selected && (
          <DetailPanel atom={selected} installed={installed} onClose={() => setSelected(null)} />
        )}
      </div>
      <SyncStatus statuses={statuses} onClick={() => setShowSettings('repositories')} />
    </div>
  )
}
