import { sql, type RawBuilder } from 'kysely';

import type { GeoPoint } from '../../persistence/ports/geography';
import type { Geography } from './schema.types';

export function geographyPoint(point: GeoPoint): RawBuilder<Geography> {
  return sql<Geography>`ST_SetSRID(ST_MakePoint(${point.longitude}, ${point.latitude}), 4326)::geography`;
}

export function geographyLongitude(column: string): RawBuilder<number> {
  return sql<number>`ST_X(${sql.ref(column)}::geometry)`;
}

export function geographyLatitude(column: string): RawBuilder<number> {
  return sql<number>`ST_Y(${sql.ref(column)}::geometry)`;
}

export function geoPoint(longitude: number, latitude: number): GeoPoint {
  return { longitude, latitude };
}
