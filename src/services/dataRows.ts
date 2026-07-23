import { escapeId, RowDataPacket } from 'mysql2/promise';

import type {
  ChangedRow,
  SqlColumnsShape,
  SqlTransportRow,
  SessionData,
} from '>/types';

const isSpatial = (type: string) =>
  [
    'point',
    'linestring',
    'polygon',
    'multipoint',
    'multilinestring',
    'multipolygon',
    'geometry',
    'geometrycollection',
  ].includes(type.toLowerCase());

export const isBinary = (type: string) => {
  return (
    type.startsWith('binary') ||
    type.startsWith('varbinary') ||
    type.endsWith('blob')
  );
};

type BuildKeyWhereClauseProps = {
  keyColumns: string[];
  columnsOrder: string[];
  originalRow: SqlTransportRow;
  values: unknown[];
};

export const buildKeyWhereClause = ({
  keyColumns,
  columnsOrder,
  originalRow,
  values,
}: BuildKeyWhereClauseProps) => {
  const result = keyColumns
    .map((column) => {
      const index = columnsOrder.indexOf(column);
      const value = originalRow[index];

      values.push(value);
      return `${escapeId(column)} = ?`;
    })
    .join(' AND ');
  return result;
};

type WhereWithValuesProps = {
  row: ChangedRow;
  columnsOrder: string[];
  cols: SqlColumnsShape;
  values: unknown[];
};

export const whereWithValues = ({
  row,
  columnsOrder,
  cols,
  values,
}: WhereWithValuesProps) => {
  const result = row.originalRow
    .map((val, idx) => {
      const col = columnsOrder[idx];
      const type = cols[col].type;

      if (val === null) {
        return `${escapeId(col)} IS NULL`;
      }

      if (type.startsWith('json')) {
        values.push(JSON.stringify(val));
        return `${escapeId(col)} = CAST(? AS JSON)`;
      }

      if (
        isBinary(type) &&
        val &&
        typeof val === 'object' &&
        !Buffer.isBuffer(val) &&
        'type' in val &&
        (val as any).type === 'Buffer'
      ) {
        values.push(Buffer.from((val as any).data));
        return `${escapeId(col)} = ?`;
      }

      values.push(val);
      return `${escapeId(col)} = ?`;
    })
    .join(' AND ');
  return result;
};

type SelectWithKeysProps = {
  selectFirst: string;
  allKeys: string[];
  columnsOrder: string[];
  originalRow: SqlTransportRow;
  sessionData: SessionData;
};
export const selectWithKeys = async ({
  selectFirst,
  allKeys,
  columnsOrder,
  originalRow,
  sessionData,
}: SelectWithKeysProps) => {
  if (!allKeys.length) return false;
  const selectValues: unknown[] = [];

  const whereClause = buildKeyWhereClause({
    keyColumns: allKeys,
    columnsOrder,
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
  row: ChangedRow;
  columnsOrder: string[];
  values: unknown[];
  allKeys: string[];
};

export const whereWithKeys = ({
  row,
  columnsOrder,
  values,
  allKeys,
}: WhereWithKeysProps) => {
  return buildKeyWhereClause({
    keyColumns: allKeys,
    columnsOrder,
    originalRow: row.originalRow as SqlTransportRow,
    values,
  });
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
    transform: (value: any) => `POINT(${value.x} ${value.y})`,
  },
  linestring: {
    sql: 'ST_GeomFromText(?)',
    transform: (value: { x: number; y: number }[]) =>
      `LINESTRING(${value.map((p) => `${p.x} ${p.y}`).join(', ')})`,
  },

  polygon: {
    sql: 'ST_GeomFromText(?)',
    transform: (value: { x: number; y: number }[][]) =>
      `POLYGON(${value
        .map((ring) => `(${ring.map((p) => `${p.x} ${p.y}`).join(', ')})`)
        .join(', ')})`,
  },

  multipoint: {
    sql: 'ST_GeomFromText(?)',
    transform: (value: Record<'x' | 'y', number>[]) =>
      `MULTIPOINT(${value.map((p) => `${p.x} ${p.y}`).join(', ')})`,
  },

  multilinestring: {
    sql: 'ST_GeomFromText(?)',
    transform: (value: Record<'x' | 'y', number>[][]) =>
      `MULTILINESTRING(${value
        .map((line) => `(${line.map((p) => `${p.x} ${p.y}`).join(', ')})`)
        .join(', ')})`,
  },
  multipolygon: {
    sql: 'ST_GeomFromText(?)',
    transform: (value: Record<'x' | 'y', number>[][][]) =>
      `MULTIPOLYGON(${value
        .map(
          (polygon) =>
            `(${polygon
              .map((ring) => `(${ring.map((p) => `${p.x} ${p.y}`).join(', ')})`)
              .join(', ')})`,
        )
        .join(', ')})`,
  },
  geometry: {
    sql: 'ST_GeomFromText(?)',
    // transform: (value: Record<string, unknown>) => value,
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

const getValueMapper = (type: string) => {
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
