export function equalAreaSqKmSql(geometrySql: string): string {
  return `ST_Area(ST_Transform(${geometrySql}, 4326)::geography) / 1000000.0`;
}
