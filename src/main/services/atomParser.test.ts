import { describe, it, expect } from 'vitest'
import { parseAtomManifest, compareVersions } from './atomParser'

const FLAT_ATOM = `
Atom {
  Name = "SimpleFuse",
  Category = "Fuses",
  Author = "TestAuthor",
  Version = 1.5,
  Description = [[A simple test fuse.]],
  Deploy = {
    "Fuses/SimpleFuse.fuse",
    "Docs/SimpleFuse.md",
  },
}
`

const PLATFORM_KEYED_ATOM = `
Atom {
  Name = "PlatformFuse",
  Category = "Tools",
  Author = "TestAuthor",
  Version = 2.0,
  Description = "Platform fuse",
  Deploy = {
    Mac = {
      "Bin/Mac/lib.dylib",
    },
    Windows = {
      "Bin/Windows/lib.dll",
    },
    Linux = {
      "Bin/Linux/lib.so",
    },
  },
}
`

const HOST_KEYED_ATOM = `
Atom {
  Name = "ResolveOnly",
  Category = "Tools",
  Author = "TestAuthor",
  Version = 1.0,
  Description = "Resolve-only tool",
  Deploy = {
    Resolve = {
      "Scripts/Comp/ResolveOnly.lua",
    },
    Fusion = {
      "Scripts/Comp/FusionOnly.lua",
    },
  },
}
`

const NESTED_ATOM = `
Atom {
  Name = "NestedTool",
  Category = "Tools",
  Author = "TestAuthor",
  Version = 9.02,
  Description = [[Nested deploy tool.]],
  Deploy = {
    Resolve = {
      Mac = {
        "Bin/Mac/resolve_tool",
      },
      Windows = {
        "Bin/Windows/resolve_tool.exe",
      },
    },
    Fusion = {
      "Fuses/FusionShared.fuse",
    },
  },
}
`

const LINUX_ONLY_ATOM = `
Atom {
  Name = "LinuxOnly",
  Category = "Tools",
  Author = "TestAuthor",
  Version = 1.0,
  Description = "Linux only",
  Deploy = {
    Linux = {
      "Bin/Linux/tool",
    },
  },
}
`

describe('parseAtomManifest', () => {
  it('parses basic fields from a flat atom', () => {
    const result = parseAtomManifest(FLAT_ATOM, 'Mac')
    expect(result.name).toBe('SimpleFuse')
    expect(result.category).toBe('Fuses')
    expect(result.author).toBe('TestAuthor')
    expect(result.version).toBe('1.5')
    expect(result.description).toBe('A simple test fuse.')
  })

  it('extracts all files from a flat deploy list', () => {
    const result = parseAtomManifest(FLAT_ATOM, 'Mac')
    expect(result.deployFiles).toEqual(['Fuses/SimpleFuse.fuse', 'Docs/SimpleFuse.md'])
    expect(result.hasFilesForPlatform).toBe(true)
  })

  it('extracts platform-specific files (Mac)', () => {
    const result = parseAtomManifest(PLATFORM_KEYED_ATOM, 'Mac')
    expect(result.deployFiles).toEqual(['Bin/Mac/lib.dylib'])
  })

  it('extracts platform-specific files (Windows)', () => {
    const result = parseAtomManifest(PLATFORM_KEYED_ATOM, 'Windows')
    expect(result.deployFiles).toEqual(['Bin/Windows/lib.dll'])
  })

  it('returns empty deployFiles and hasFilesForPlatform=false for Linux-only atom on Mac', () => {
    const result = parseAtomManifest(LINUX_ONLY_ATOM, 'Mac')
    expect(result.deployFiles).toEqual([])
    expect(result.hasFilesForPlatform).toBe(false)
  })

  it('extracts Resolve files from host-keyed deploy (ignores Fusion)', () => {
    const result = parseAtomManifest(HOST_KEYED_ATOM, 'Mac')
    expect(result.deployFiles).toEqual(['Scripts/Comp/ResolveOnly.lua'])
  })

  it('extracts nested Resolve+Mac files', () => {
    const result = parseAtomManifest(NESTED_ATOM, 'Mac')
    expect(result.deployFiles).toEqual(['Bin/Mac/resolve_tool'])
  })

  it('extracts nested Resolve+Windows files', () => {
    const result = parseAtomManifest(NESTED_ATOM, 'Windows')
    expect(result.deployFiles).toEqual(['Bin/Windows/resolve_tool.exe'])
  })

  it('parses version as string preserving format', () => {
    const result = parseAtomManifest(NESTED_ATOM, 'Mac')
    expect(result.version).toBe('9.02')
  })
})

describe('compareVersions', () => {
  it('returns 0 for equal versions', () => {
    expect(compareVersions('1.0', '1.0')).toBe(0)
  })

  it('returns positive when a > b', () => {
    expect(compareVersions('2.0', '1.5')).toBeGreaterThan(0)
  })

  it('returns negative when a < b', () => {
    expect(compareVersions('1.0', '1.5')).toBeLessThan(0)
  })

  it('handles three-part versions correctly', () => {
    expect(compareVersions('1.0.1', '1.0.0')).toBeGreaterThan(0)
    expect(compareVersions('1.0', '1.0.1')).toBeLessThan(0)
  })

  it('treats 9.02 as major=9, minor=2 (not 9.2)', () => {
    expect(compareVersions('9.02', '9.1')).toBeGreaterThan(0)
  })
})
