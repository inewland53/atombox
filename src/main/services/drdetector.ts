import { existsSync, accessSync, constants } from 'fs'
import path from 'path'
import os from 'os'

export const MAC_FUSION_PATH = path.join(
  os.homedir(),
  'Library/Application Support/Blackmagic Design/DaVinci Resolve/Fusion'
)

export const WIN_FUSION_PATH = path.join(
  process.env.APPDATA ?? path.join(os.homedir(), 'AppData/Roaming'),
  'Blackmagic Design/DaVinci Resolve/Fusion'
)

export function detectFusionPath(platform: NodeJS.Platform = process.platform): string | null {
  const candidate = platform === 'win32' ? WIN_FUSION_PATH : MAC_FUSION_PATH
  const resolved = path.resolve(candidate)
  try {
    if (!existsSync(resolved)) return null
    accessSync(resolved, constants.W_OK)
    return resolved
  } catch {
    return null
  }
}
