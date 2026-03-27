import { contextBridge, ipcRenderer } from 'electron'
import type { IpcApi } from './renderer/types/atom'

const api: IpcApi = {
  // Installed state
  getInstalled: () => ipcRenderer.invoke('installed:get'),
  detectInstalled: (atoms) => ipcRenderer.invoke('installed:detect', atoms),
  installAtom: (atom) => ipcRenderer.invoke('atom:install', atom),
  uninstallAtom: (atomId) => ipcRenderer.invoke('atom:uninstall', atomId),

  // Settings
  getFusionPath: () => ipcRenderer.invoke('settings:getFusionPath'),
  setFusionPath: (p) => ipcRenderer.invoke('settings:setFusionPath', p),

  // Repositories
  listRepos: () => ipcRenderer.invoke('repos:list'),
  addRepo: (repo) => ipcRenderer.invoke('repos:add', repo),
  removeRepo: (id) => ipcRenderer.invoke('repos:remove', id),
  updateRepo: (payload) => ipcRenderer.invoke('repos:update', payload),
  exportRepos: () => ipcRenderer.invoke('repos:export'),
  importRepos: (json) => ipcRenderer.invoke('repos:import', json),

  // Repo lifecycle
  fetchRepoCount: (sourceId) => ipcRenderer.invoke('repos:fetchCount', sourceId),
  syncRepo: (sourceId) => ipcRenderer.invoke('repos:sync', sourceId),
  startupSync: () => ipcRenderer.invoke('catalog:startup'),
  onRepoStatus: (cb) => {
    const h = (_: any, event: any) => cb(event)
    ipcRenderer.on('repo:status', h)
    return () => ipcRenderer.off('repo:status', h)
  },
  onRepoBatch: (cb) => {
    const h = (_: any, payload: any) => cb(payload)
    ipcRenderer.on('repo:batch', h)
    return () => ipcRenderer.off('repo:batch', h)
  },

  // Progress events
  onInstallProgress: (cb) => {
    const handler = (_event: Electron.IpcRendererEvent, progress: any) => cb(progress)
    ipcRenderer.on('install:progress', handler)
    return () => ipcRenderer.off('install:progress', handler)
  },
  onInstallError: (cb) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: any) => cb(payload)
    ipcRenderer.on('install:error', handler)
    return () => ipcRenderer.off('install:error', handler)
  },
}

contextBridge.exposeInMainWorld('api', api)
