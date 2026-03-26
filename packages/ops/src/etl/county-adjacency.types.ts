import type { BatchRunArtifactLayout } from "./batch-artifact-layout.types";

export interface CountyAdjacencyBoundaryVersionRecord {
  readonly boundaryRelationName: string;
  readonly boundaryVersion: string;
  readonly publishedRowCount: number;
  readonly sourceAsOfDate: string | null;
  readonly sourceRefreshedAt: string;
  readonly sourceRelationName: string;
  readonly sourceRowCount: number;
}

export interface CountyAdjacencyPublicationRecord {
  readonly artifactAbsolutePath: string | null;
  readonly artifactRelativePath: string | null;
  readonly boundaryVersion: string | null;
  readonly publicationKey: string;
  readonly publishedAt: string | null;
  readonly runId: string | null;
}

export interface CountyAdjacencyRunContext extends BatchRunArtifactLayout {
  readonly adjacencyArtifactDir: string;
  readonly adjacencyArtifactPath: string;
  readonly buildCsvPath: string;
  readonly buildSqlPath: string;
  readonly publishCsvPath: string;
  readonly publishSqlPath: string;
  readonly runSummaryPath: string;
}

export interface RefreshCountyAdjacencyArgs {
  readonly env?: NodeJS.ProcessEnv;
  readonly projectRoot: string;
}

export interface RefreshCountyAdjacencyResult {
  readonly artifactPath: string;
  readonly boundaryVersion: string;
  readonly builtArtifact: boolean;
  readonly publishedToPostgres: boolean;
  readonly runId: string;
  readonly skippedPublishReason: "boundary_version_unchanged" | null;
}
