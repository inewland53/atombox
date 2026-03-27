export type Platform = 'Mac' | 'Windows'

export interface ParsedAtom {
  name: string
  category: string
  author: string
  version: string
  description: string
  deployFiles: string[]
  hasFilesForPlatform: boolean
}

export function parseAtomManifest(content: string, platform: Platform): ParsedAtom {
  const name = extractString(content, 'Name') ?? ''
  const category = extractString(content, 'Category') ?? ''
  const author = extractString(content, 'Author') ?? ''
  const version = extractVersion(content) ?? '1.0'
  const description = extractDescription(content) ?? ''

  const deploySection = extractDeploySection(content)
  const deployFiles = resolveDeployFiles(deploySection, platform)

  return { name, category, author, version, description, deployFiles, hasFilesForPlatform: deployFiles.length > 0 }
}

function extractString(content: string, key: string): string | null {
  const quoted = content.match(new RegExp(`\\b${key}\\s*=\\s*"([^"]*)"`, 's'))
  if (quoted) return quoted[1]
  const multiline = content.match(new RegExp(`\\b${key}\\s*=\\s*\\[\\[[\\s\\S]*?\\]\\]`))
  if (multiline) {
    const inner = multiline[0].match(/\[\[([\s\S]*?)\]\]/)
    return inner ? inner[1].trim() : null
  }
  return null
}

function extractVersion(content: string): string | null {
  const m = content.match(/\bVersion\s*=\s*([\d.]+)/)
  return m ? m[1] : null
}

function extractDescription(content: string): string | null {
  const multiline = content.match(/\bDescription\s*=\s*\[\[([\s\S]*?)\]\]/)
  if (multiline) return multiline[1].trim()
  const quoted = content.match(/\bDescription\s*=\s*"([^"]*)"/)
  return quoted ? quoted[1] : null
}

function extractDeploySection(content: string): string {
  const idx = content.search(/\bDeploy\s*=\s*\{/)
  if (idx === -1) return '{}'
  const braceStart = content.indexOf('{', idx)
  return extractBalancedBraces(content, braceStart) ?? '{}'
}

function extractBalancedBraces(content: string, start: number): string | null {
  let depth = 0
  for (let i = start; i < content.length; i++) {
    if (content[i] === '{') depth++
    else if (content[i] === '}') {
      depth--
      if (depth === 0) return content.slice(start, i + 1)
    }
  }
  return null
}

function resolveDeployFiles(deploySection: string, platform: Platform): string[] {
  const inner = deploySection.slice(1, -1).trim()
  const hasPlatformKey = /\b(Mac|Windows|Linux)\s*=\s*\{/.test(inner)
  const hasHostKey = /\b(Resolve|Fusion)\s*=\s*\{/.test(inner)

  if (!hasPlatformKey && !hasHostKey) return extractStringList(inner)

  if (hasHostKey) {
    const resolveInner = extractSubTable(inner, 'Resolve')
    if (resolveInner !== null) {
      const resolveHasPlatform = /\b(Mac|Windows|Linux)\s*=\s*\{/.test(resolveInner)
      if (resolveHasPlatform) {
        const platformInner = extractSubTable(resolveInner, platform)
        return platformInner !== null ? extractStringList(platformInner) : []
      }
      return extractStringList(resolveInner)
    }
    const fusionInner = extractSubTable(inner, 'Fusion')
    return fusionInner !== null ? extractStringList(fusionInner) : []
  }

  const platformInner = extractSubTable(inner, platform)
  return platformInner !== null ? extractStringList(platformInner) : []
}

function extractSubTable(content: string, key: string): string | null {
  const regex = new RegExp(`\\b${key}\\s*=\\s*\\{`)
  const m = content.match(regex)
  if (!m || m.index === undefined) return null
  const braceStart = content.indexOf('{', m.index)
  const balanced = extractBalancedBraces(content, braceStart)
  return balanced ? balanced.slice(1, -1).trim() : null
}

function extractStringList(content: string): string[] {
  return [...content.matchAll(/"([^"]+)"/g)].map(m => m[1])
}

export function compareVersions(a: string, b: string): number {
  const aParts = a.split('.').map(p => parseInt(p, 10))
  const bParts = b.split('.').map(p => parseInt(p, 10))
  const maxLen = Math.max(aParts.length, bParts.length)
  for (let i = 0; i < maxLen; i++) {
    const av = aParts[i] ?? 0
    const bv = bParts[i] ?? 0
    if (av !== bv) return av > bv ? 1 : -1
  }
  return 0
}
