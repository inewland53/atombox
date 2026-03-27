export interface Atom {
  id: string            // directory name, e.g. "com.AndrewHazelden.KartaVR"
  name: string
  category: string
  author: string
  version: string       // stored as string, e.g. "1.0", "9.02", "1.0.1"
  description: string
  thumbnailUrl: string  // GitLab raw URL, may 404 (renderer handles with placeholder)
  gitlabUrl: string     // link to atom directory on GitLab
  atomDir: string       // actual GitLab directory path, e.g. "Atoms/Tools/com.MyAtom"
  hasFilesForPlatform: boolean  // false if atom has no files for Mac/Windows
  deployFiles: string[] // relative paths of files to deploy, used during install
  sourceId: string      // uuid or 'builtin-reactor'
  sourceName: string    // display name, e.g. "My Private Fuses"
}

export interface InstalledRecord {
  version: string       // version string at time of install
  installedAt: string   // ISO date
  files: string[]       // relative to <FusionDir>/Reactor/Deploy/
}

export type InstalledMap = Record<string, InstalledRecord>

export type RepoType = 'gitlab' | 'github' | 'local' | 'http'

export interface RepoSource {
  id: string              // uuid or 'builtin-reactor'
  name: string            // display name, e.g. "My Private Fuses"
  type: RepoType
  url: string             // URL or local filesystem path
  categoryLabel: string   // user-defined group, e.g. "Work"
  refreshInterval: number // hours; 0 = manual only
  addedAt: string         // ISO date
  lastFetched: string | null
}

export type RepoState = 'idle' | 'fetching' | 'fetched' | 'syncing' | 'synced' | 'error'

export interface RepoStatus {
  sourceId: string
  state: RepoState
  atomCount: number | null
  progress: { loaded: number; total: number } | null
  error: string | null
}

export interface RepoStatusEvent {
  sourceId: string
  state: RepoState
  atomCount?: number
  progress?: { loaded: number; total: number }
  error?: string
}

export interface InstallProgress {
  atomId: string
  file: string
  index: number
  total: number
}

export interface IpcApi {
  // Installed state
  getInstalled: () => Promise<InstalledMap>
  detectInstalled: (atoms: Atom[]) => Promise<void>

  // File operations
  installAtom: (atom: Atom) => Promise<void>
  uninstallAtom: (atomId: string) => Promise<void>

  // Settings
  getFusionPath: () => Promise<string | null>
  setFusionPath: (path: string) => Promise<void>

  // Repositories
  listRepos: () => Promise<RepoSource[]>
  addRepo: (repo: Omit<RepoSource, 'id' | 'addedAt' | 'lastFetched'>) => Promise<RepoSource>
  removeRepo: (id: string) => Promise<void>
  updateRepo: (payload: { id: string } & Partial<Pick<RepoSource, 'type' | 'url' | 'name' | 'categoryLabel' | 'refreshInterval'>>) => Promise<RepoSource>
  exportRepos: () => Promise<string>
  importRepos: (json: string) => Promise<RepoSource[]>

  // Repo lifecycle
  fetchRepoCount: (sourceId: string) => Promise<number>
  syncRepo: (sourceId: string) => Promise<void>
  startupSync: () => Promise<void>
  onRepoStatus: (cb: (event: RepoStatusEvent) => void) => () => void
  onRepoBatch: (cb: (payload: { sourceId: string; atoms: Atom[] }) => void) => () => void

  // Progress events (renderer listens, returns unsubscribe fn)
  onInstallProgress: (cb: (progress: InstallProgress) => void) => () => void
  onInstallError: (cb: (payload: { atomId: string; error: string }) => void) => () => void
}

declare global {
  interface Window {
    api: IpcApi
  }
}
