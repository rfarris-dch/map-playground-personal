export interface WorkspaceSurface {
  readonly directoryName: string;
  readonly displayPath: string;
  readonly packageName: string;
}

export interface WorkspaceHeroTab {
  readonly isActive: boolean;
  readonly name: string;
}

export interface WorkspaceHeroModel {
  readonly appCount: number;
  readonly codeSample: string;
  readonly packageCount: number;
  readonly tabs: readonly WorkspaceHeroTab[];
}
