import { useState, useEffect, useRef } from 'react'
import { RepoSource, RepoType, RepoStatus } from '../types/atom'
import { useRepos } from '../hooks/useRepos'

interface Props {
  onBack: () => void
  onRefresh: () => void
  statuses: Map<string, RepoStatus>
  onFetch: (sourceId: string) => void
  onSync: (sourceId: string) => void
  initialTab?: string
}

const tabs = [
  { id: 'general', label: 'General', icon: '⚙' },
  { id: 'repositories', label: 'Repositories', icon: '⊞' },
]

const TYPE_LABELS: Record<RepoType, string> = {
  gitlab: 'GitLab',
  github: 'GitHub',
  local: 'Local',
  http: 'HTTP',
}

const TYPE_BADGE_CLASSES: Record<RepoType, string> = {
  gitlab: 'bg-amber-700 text-amber-100',
  github: 'bg-green-700 text-green-100',
  local: 'bg-blue-700 text-blue-100',
  http: 'bg-purple-700 text-purple-100',
}

const URL_LABEL: Record<RepoType, string> = {
  gitlab: 'GitLab URL',
  github: 'GitHub URL',
  local: 'Local Path',
  http: 'HTTP URL',
}

const REFRESH_OPTIONS = [
  { label: 'Manual', value: 0 },
  { label: '1h', value: 1 },
  { label: '6h', value: 6 },
  { label: '12h', value: 12 },
  { label: '24h', value: 24 },
  { label: '48h', value: 48 },
]

function TypeBadge({ type }: { type: RepoType }) {
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded font-mono ${TYPE_BADGE_CLASSES[type]}`}>
      [{TYPE_LABELS[type]}]
    </span>
  )
}

interface RepoModalProps {
  onClose: () => void
  onAdd: (repo: Omit<RepoSource, 'id' | 'addedAt' | 'lastFetched'>) => Promise<unknown>
  onEdit: (payload: { id: string } & Partial<Pick<RepoSource, 'type' | 'url' | 'name' | 'categoryLabel' | 'refreshInterval'>>) => Promise<unknown>
  editing?: RepoSource | null
}

function RepoModal({ onClose, onAdd, onEdit, editing }: RepoModalProps) {
  const [type, setType] = useState<RepoType>(editing?.type ?? 'gitlab')
  const [url, setUrl] = useState(editing?.url ?? '')
  const [name, setName] = useState(editing?.name ?? '')
  const [categoryLabel, setCategoryLabel] = useState(editing?.categoryLabel ?? '')
  const [refreshInterval, setRefreshInterval] = useState(editing?.refreshInterval ?? 0)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit() {
    if (!url.trim() || !name.trim()) return
    setSubmitting(true)
    try {
      if (editing) {
        await onEdit({ id: editing.id, type, url: url.trim(), name: name.trim(), categoryLabel: categoryLabel.trim(), refreshInterval })
      } else {
        await onAdd({ type, url: url.trim(), name: name.trim(), categoryLabel: categoryLabel.trim(), refreshInterval })
      }
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  const repoTypes: RepoType[] = ['gitlab', 'github', 'local', 'http']

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-gray-800 border border-gray-700 rounded-lg w-full max-w-md p-6 shadow-xl">
        <h3 className="text-base font-bold text-gray-100 mb-4">
          {editing ? 'Edit Repository' : 'Add Repository'}
        </h3>

        {/* Type selector */}
        <div className="mb-4">
          <label className="block text-xs text-gray-400 uppercase tracking-wide mb-2">Type</label>
          <div className="flex gap-2">
            {repoTypes.map(t => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  type === t
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        {/* URL / Path */}
        <div className="mb-4">
          <label className="block text-xs text-gray-400 uppercase tracking-wide mb-2">
            {URL_LABEL[type]}
          </label>
          <input
            type="text"
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder={type === 'local' ? '/path/to/repo' : 'https://...'}
            className="w-full bg-gray-700 text-gray-100 rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Display name */}
        <div className="mb-4">
          <label className="block text-xs text-gray-400 uppercase tracking-wide mb-2">Display Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="My Private Fuses"
            className="w-full bg-gray-700 text-gray-100 rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Category label */}
        <div className="mb-4">
          <label className="block text-xs text-gray-400 uppercase tracking-wide mb-2">Category Label</label>
          <input
            type="text"
            value={categoryLabel}
            onChange={e => setCategoryLabel(e.target.value)}
            placeholder="Work"
            className="w-full bg-gray-700 text-gray-100 rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Refresh interval */}
        <div className="mb-6">
          <label className="block text-xs text-gray-400 uppercase tracking-wide mb-2">Refresh Interval</label>
          <select
            value={refreshInterval}
            onChange={e => setRefreshInterval(Number(e.target.value))}
            className="bg-gray-700 text-gray-100 rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500"
          >
            {REFRESH_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !url.trim() || !name.trim()}
            className="px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded text-sm"
          >
            {submitting
              ? (editing ? 'Saving…' : 'Adding…')
              : (editing ? 'Save Changes' : 'Add Repository')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Settings({ onBack, onRefresh, statuses, onFetch, onSync, initialTab }: Props) {
  const [activeTab, setActiveTab] = useState(initialTab ?? 'general')

  // General tab state
  const [fusionPath, setFusionPath] = useState('')
  const [saved, setSaved] = useState(false)

  // Repositories tab state
  const { repos, addRepo, removeRepo, updateRepo, exportRepos, importRepos } = useRepos()
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingRepo, setEditingRepo] = useState<RepoSource | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    window.api.getFusionPath().then(p => setFusionPath(p ?? ''))
  }, [])

  async function handleSave() {
    await window.api.setFusionPath(fusionPath)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleDeleteRepo(id: string) {
    await removeRepo.mutateAsync(id)
    setConfirmDeleteId(null)
  }

  async function handleAddRepo(repo: Omit<RepoSource, 'id' | 'addedAt' | 'lastFetched'>) {
    const newRepo = await addRepo.mutateAsync(repo)
    // Auto-fetch the new repo
    onFetch(newRepo.id)
    return newRepo
  }

  async function handleEditRepo(payload: { id: string } & Partial<Pick<RepoSource, 'type' | 'url' | 'name' | 'categoryLabel' | 'refreshInterval'>>) {
    await updateRepo.mutateAsync(payload)
  }

  async function handleExport() {
    const json = await exportRepos()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'atombox-repos.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleImportClick() {
    fileInputRef.current?.click()
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    await importRepos.mutateAsync(text)
    // Reset file input so the same file can be re-imported if needed
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function formatRefreshInterval(hours: number): string {
    if (hours === 0) return 'Manual'
    return `${hours}h`
  }

  // repos from useRepos() already includes the builtin as the first entry
  const allRows: (RepoSource & { isBuiltin: boolean })[] = repos.map((r) => ({
    ...r,
    isBuiltin: r.id === 'builtin-reactor',
  }))

  return (
    <div className="h-screen flex bg-gray-900 text-gray-100 overflow-hidden">
      {/* Tab column */}
      <div className="w-48 bg-gray-800 border-r border-gray-700 flex flex-col flex-shrink-0">
        <button
          onClick={onBack}
          className="w-full text-left px-3 py-2 text-sm text-gray-400 hover:text-white"
        >
          ← Back
        </button>
        <div className="border-b border-gray-700" />
        <nav className="flex flex-col py-2">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white font-semibold'
                  : 'text-gray-400 hover:bg-gray-700 hover:text-white'
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'general' && (
          <>
            <h2 className="text-base font-bold text-gray-100 mb-4">General</h2>

            <div className="mb-6">
              <label className="block text-xs text-gray-400 uppercase tracking-wide mb-2">
                Fusion Scripts Path
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={fusionPath}
                  onChange={e => setFusionPath(e.target.value)}
                  placeholder="/path/to/Fusion"
                  className="flex-1 max-w-lg bg-gray-700 text-gray-100 rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  onClick={handleSave}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm whitespace-nowrap"
                >
                  {saved ? 'Saved!' : 'Save Path'}
                </button>
              </div>
            </div>

          </>
        )}

        {activeTab === 'repositories' && (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-gray-100">Repositories</h2>
              <button
                onClick={() => setShowAddModal(true)}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm"
              >
                + Add Repository
              </button>
            </div>

            {/* Repo list */}
            <div className="space-y-2 mb-6">
              {allRows.map(row => (
                <div
                  key={row.id}
                  className="flex items-center gap-3 bg-gray-800 border border-gray-700 rounded px-4 py-3"
                >
                  <TypeBadge type={row.type} />
                  <span className="font-medium text-sm text-gray-100 flex-shrink-0">{row.name}</span>
                  <span className="text-sm text-gray-400 flex-shrink-0">{row.categoryLabel}</span>
                  {!row.isBuiltin && (
                    <span className="text-xs text-gray-500 flex-shrink-0">
                      {formatRefreshInterval(row.refreshInterval)}
                    </span>
                  )}
                  {/* Repo state */}
                  {(() => {
                    const s = statuses.get(row.id)
                    const state = s?.state ?? 'idle'
                    if (state === 'synced') return (
                      <span className="text-xs text-green-400">{s?.atomCount ?? 0} atoms ✓</span>
                    )
                    if (state === 'fetched') return (
                      <span className="flex items-center gap-1.5">
                        <span className="text-xs text-blue-400">{s?.atomCount ?? 0} atoms</span>
                        <button onClick={() => onSync(row.id)} className="text-xs px-2.5 py-1 bg-blue-600 hover:bg-blue-500 rounded transition-colors">Sync</button>
                      </span>
                    )
                    if (state === 'syncing') return (
                      <span className="text-xs text-gray-400 animate-pulse">
                        Syncing{s?.progress ? ` ${s.progress.loaded}/${s.progress.total}` : '…'}
                      </span>
                    )
                    if (state === 'fetching') return <span className="text-xs text-gray-400 animate-pulse">Fetching…</span>
                    if (state === 'error') return (
                      <span className="flex items-center gap-1.5">
                        <span className="text-xs text-red-400">Error</span>
                        <button onClick={() => onFetch(row.id)} className="text-xs px-2.5 py-1 bg-gray-600 hover:bg-gray-500 rounded transition-colors">Retry</button>
                      </span>
                    )
                    if (!row.isBuiltin) return (
                      <button onClick={() => onFetch(row.id)} className="text-xs px-2.5 py-1 bg-gray-600 hover:bg-gray-500 rounded transition-colors text-gray-300">Fetch</button>
                    )
                    return null
                  })()}
                  <div className="flex-1" />
                  {row.isBuiltin ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onSync(row.id)}
                        title="Refresh repository"
                        className="text-gray-500 hover:text-green-400 transition-colors text-base px-1.5"
                      >
                        ↻
                      </button>
                      <span className="text-xs text-gray-500 italic">(built-in)</span>
                    </div>
                  ) : confirmDeleteId === row.id ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-gray-300">Delete permanently?</span>
                      <button
                        onClick={() => handleDeleteRepo(row.id)}
                        className="px-2 py-0.5 bg-red-600 hover:bg-red-500 rounded text-xs text-white transition-colors"
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-2 py-0.5 bg-gray-600 hover:bg-gray-500 rounded text-xs text-gray-300 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onSync(row.id)}
                        title="Refresh repository"
                        className="text-gray-500 hover:text-green-400 transition-colors text-base px-1.5"
                      >
                        ↻
                      </button>
                      <button
                        onClick={() => { setConfirmDeleteId(null); setEditingRepo(row) }}
                        title="Edit repository"
                        className="text-gray-500 hover:text-blue-400 transition-colors text-base px-1.5"
                      >
                        ✎
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(row.id)}
                        title="Remove repository"
                        className="text-gray-500 hover:text-red-400 transition-colors text-base px-1.5"
                      >
                        🗑
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Export / Import */}
            <div className="flex gap-2 border-t border-gray-700 pt-4">
              <button
                onClick={handleExport}
                className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm"
              >
                Export
              </button>
              <button
                onClick={handleImportClick}
                className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm"
              >
                Import
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleImportFile}
              />
            </div>
          </>
        )}
      </div>

      {/* Add / Edit Repository modal */}
      {(showAddModal || editingRepo) && (
        <RepoModal
          key={editingRepo?.id ?? 'new'}
          onClose={() => { setShowAddModal(false); setEditingRepo(null) }}
          onAdd={handleAddRepo}
          onEdit={handleEditRepo}
          editing={editingRepo}
        />
      )}
    </div>
  )
}
