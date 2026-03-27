import type { Atom, RepoSource } from '../../renderer/types/atom'

export interface RepoProvider {
  fetchCatalog(
    source: RepoSource,
    onBatch?: (atoms: Atom[]) => void,
    onProgress?: (loaded: number, total: number) => void,
    onEnumProgress?: (counted: number) => void,
    knownAtomDirs?: Set<string>
  ): Promise<Atom[]>
  fetchFile(source: RepoSource, relativePath: string): Promise<Buffer>
  countAtoms(source: RepoSource): Promise<number>
}
