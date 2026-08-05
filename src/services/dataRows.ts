import { escapeId, RowDataPacket } from 'mysql2/promise';
import { appErrors } from './errorLayer';
import type {
  ChangedRow,
  SqlColumnsShape,
  SqlTransportRow,
  SessionData,
  FilterColumnParams,
} from '>/types';

export const isSpatial = (type: string) =>
  [
    'point',
    'linestring',
    'polygon',
    'multipoint',
    'multilinestring',
    'multipolygon',
    'geometry',
    'geomcollection',
  ].includes(type.toLowerCase());

export const isBinary = (type: string) => {
  return (
    type.startsWith('binary') ||
    type.startsWith('varbinary') ||
    type.endsWith('blob')
  );
};

type BuildKeyWhereClauseProps = {
  cols: SqlColumnsShape;
  keyColumns: string[];
  columnsOrder: string[];
  originalRow: SqlTransportRow;
  values: unknown[];
};

export const buildKeyWhereClause = ({
  cols,
  columnsOrder,
  originalRow,
  keyColumns,
  values,
}: BuildKeyWhereClauseProps) => {
  return keyColumns
    .map((column) => {
      const index = columnsOrder.indexOf(column);
      const type = cols[column].type;
      const value = transformSqlValue(type, originalRow[index]);

      values.push(value);

      return `${escapeId(column)} = ?`;
    })
    .join(' AND ');
};

type WhereWithValuesProps = {
  cols: SqlColumnsShape;
  columnsOrder: string[];
  row: ChangedRow;
  values: unknown[];
};

export const whereWithValues = ({
  cols,
  columnsOrder,
  row,
  values,
}: WhereWithValuesProps) => {
  const result = row.originalRow
    .map((val, idx) => {
      const col = columnsOrder[idx];
      const type = cols[col].type;

      if (val === null) {
        return `${escapeId(col)} IS NULL`;
      }

      values.push(transformSqlValue(type, val));

      if (type.startsWith('json')) {
        return `${escapeId(col)} = CAST(? AS JSON)`;
      }

      return `${escapeId(col)} = ?`;
    })
    .join(' AND ');

  return result;
};

type SelectWithKeysProps = {
  cols: SqlColumnsShape;
  columnsOrder: string[];
  selectFirst: string;
  allKeys: string[];
  originalRow: SqlTransportRow;
  sessionData: SessionData;
};
export const selectWithKeys = async ({
  cols,
  columnsOrder,
  selectFirst,
  allKeys,
  originalRow,
  sessionData,
}: SelectWithKeysProps) => {
  if (!allKeys.length) return false;
  const selectValues: unknown[] = [];

  const whereClause = buildKeyWhereClause({
    cols,
    columnsOrder,
    keyColumns: allKeys,
    originalRow,
    values: selectValues,
  });
  const selectQuery = `${selectFirst} WHERE ${whereClause}`;
  const [result] = await sessionData.sqlSession.query<RowDataPacket[]>(
    selectQuery,
    selectValues,
  );
  return result.length === 1;
};

type WhereWithKeysProps = {
  cols: SqlColumnsShape;
  row: ChangedRow;
  columnsOrder: string[];
  values: unknown[];
  allKeys: string[];
};

export const whereWithKeys = ({
  cols,
  columnsOrder,
  row,
  values,
  allKeys,
}: WhereWithKeysProps) => {
  return buildKeyWhereClause({
    cols,
    columnsOrder,
    keyColumns: allKeys,
    originalRow: row.originalRow as SqlTransportRow,
    values,
  });
};

const createGeometryError = (type: string) => {
  return {
    errno: 0,
    code: 'invalid_geometry',
    sqlState: '0',
    sqlMessage:
      'Geometry type is missing or no transformer available for the given type',
    sql: type,
  };
};

const geoPrimitiveTransformers: Record<string, CallableFunction> = {
  point: (geometry: { coordinates: [number, number] }) => {
    const [x, y] = geometry.coordinates;
    return `POINT(${x} ${y})`;
  },

  linestring: (geometry: { coordinates: [number, number][] }) =>
    `LINESTRING(${geometry.coordinates
      .map(([x, y]) => `${x} ${y}`)
      .join(', ')})`,

  polygon: (geometry: { coordinates: [number, number][][] }) =>
    `POLYGON(${geometry.coordinates
      .map((ring) => `(${ring.map(([x, y]) => `${x} ${y}`).join(', ')})`)
      .join(', ')})`,

  multipoint: (geometry: { coordinates: [number, number][] }) =>
    `MULTIPOINT(${geometry.coordinates
      .map(([x, y]) => `${x} ${y}`)
      .join(', ')})`,

  multilinestring: (geometry: { coordinates: [number, number][][] }) =>
    `MULTILINESTRING(${geometry.coordinates
      .map((line) => `(${line.map(([x, y]) => `${x} ${y}`).join(', ')})`)
      .join(', ')})`,

  multipolygon: (geometry: { coordinates: [number, number][][][] }) =>
    `MULTIPOLYGON(${geometry.coordinates
      .map(
        (polygon) =>
          `(${polygon
            .map((ring) => `(${ring.map(([x, y]) => `${x} ${y}`).join(', ')})`)
            .join(', ')})`,
      )
      .join(', ')})`,
};

const transformGeometryCollection = (geometry: any) => {
  const geometries = geometry.geometries;

  return `GEOMETRYCOLLECTION(${geometries
    .map((g: any) => {
      const type = g.type.toLowerCase();

      const convert = geoPrimitiveTransformers[type];

      if (!convert) {
        throw appErrors.mysql(createGeometryError(g.type));
      }

      return convert(g);
    })
    .join(', ')})`;
};

type SqlValueMapper = {
  sql: string;
  transform?: CallableFunction;
};
const valueRemappers: Record<string, SqlValueMapper> = {
  json: {
    sql: 'CAST(? AS JSON)',
    transform: JSON.stringify,
  },
  point: {
    sql: 'ST_GeomFromText(?)',
    transform: geoPrimitiveTransformers.point,
  },
  linestring: {
    sql: 'ST_GeomFromText(?)',
    transform: geoPrimitiveTransformers.linestring,
  },
  polygon: {
    sql: 'ST_GeomFromText(?)',
    transform: geoPrimitiveTransformers.polygon,
  },
  multipoint: {
    sql: 'ST_GeomFromText(?)',
    transform: geoPrimitiveTransformers.multipoint,
  },
  multilinestring: {
    sql: 'ST_GeomFromText(?)',
    transform: geoPrimitiveTransformers.multilinestring,
  },
  multipolygon: {
    sql: 'ST_GeomFromText(?)',
    transform: geoPrimitiveTransformers.multipolygon,
  },
  geometry: {
    sql: 'ST_GeomFromText(?)',
    transform: (geometry: any) => {
      const gType = geometry.type.toLowerCase();

      if (gType === 'geometrycollection') {
        return transformGeometryCollection(geometry);
      }

      const convert = geoPrimitiveTransformers[gType];

      if (!convert) {
        throw appErrors.mysql(createGeometryError(gType));
      }

      return convert(geometry);
    },
  },

  geometrycollection: {
    sql: 'ST_GeomFromText(?)',
    transform: transformGeometryCollection,
  },
  geomcollection: {
    sql: 'ST_GeomFromText(?)',
    transform: transformGeometryCollection,
  },

  date: {
    sql: '?',
    // sql: 'STR_TO_DATE(?)',
  },
  binary: {
    sql: '?',
    transform: (value: any) => {
      if (Buffer.isBuffer(value)) {
        return value;
      }

      return Buffer.from(value.data);
    },
  },
};

export const getValueMapper = (type: string) => {
  const lType = type.toLowerCase();

  if (isBinary(lType)) {
    return valueRemappers.binary;
  }

  return valueRemappers[lType];
};

const isEmptyObjectValue = (value: unknown) => {
  if (value === null || value === undefined) return true;

  if (Array.isArray(value) && value.length === 0) return true;

  if (
    typeof value === 'object' &&
    !Buffer.isBuffer(value) &&
    Object.keys(value as object).length === 0
  ) {
    return true;
  }

  return false;
};

export const remapSqlValue = (type: string) => getValueMapper(type)?.sql ?? '?';

export const transformSqlValue = (type: string, value: unknown) => {
  if (value === null) {
    return null;
  }
  if (isSpatial(type) && isEmptyObjectValue(value)) {
    return null;
  }
  const mapper = getValueMapper(type);
  return mapper?.transform ? mapper.transform(value) : value;
};
