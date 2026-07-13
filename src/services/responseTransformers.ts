import type { FieldPacket, RowDataPacket } from 'mysql2';
import type { ColumnInfo, SqlColumnsShape, SqlQueryRow } from '>/types';

type ParseColumnTypeResult = {
  type: string;
  params: Record<string, string | number>;
};
export const parseColumnType = (columnType: string) => {
  const match = columnType.match(/^([a-zA-Z]+)(?:\((.*?)\))?/);

  if (!match) {
    return {
      type: columnType.toUpperCase(),
      params: {},
    };
  }

  const [, baseType, rawParams] = match;

  const type = baseType.toUpperCase();
  const result: ParseColumnTypeResult = {
    type,
    params: {},
  };
  switch (type) {
    case 'VARCHAR':
    case 'CHAR':
    case 'BIT':
      if (rawParams) result.params = { Length: Number(rawParams) };
      break;

    case 'DECIMAL':
    case 'NUMERIC':
      const [precision, scale] = (rawParams ?? '')
        .split(',')
        .map((v) => v.trim());

      if (precision) result.params.Precision = precision;
      if (scale) result.params.Scale = scale;
      break;

    case 'ENUM':
    case 'SET':
      if (rawParams) {
        result.params.Values = rawParams;
      }
      break;

    default:
      break;
  }
  return result;
};

export const buildColumnsOrder = (fields: FieldPacket[]) => {
  return fields.map((f, index) =>
    // f.table ? `${f.table}.${f.name}#${index}` : `${f.name}#${index}`,
    f.table ? `${f.table}.${f.name}` : `${f.name}`,
  );
};

type BuildColsProps = {
  fields: FieldPacket[];
  columnsOrder: string[];
};

export const buildCols = ({
  fields,
  columnsOrder,
}: BuildColsProps): SqlColumnsShape => {
  return Object.fromEntries(
    fields.map((f, index) => [
      columnsOrder[index],
      {
        field: f.table ? `${f.table}.${f.name}` : f.name,
        type: String(f.type),
        nullable: 'NO',
        key: '',
        defaultValue: null,
        extra: '',
      },
    ]),
  );
};

type BuildRowsProps = {
  result: Record<string, unknown>[];
  fields: FieldPacket[];
};

type NestedRow = Record<string, Record<string, unknown>>;
export const buildRows = ({ result, fields }: BuildRowsProps) => {
  return (result as NestedRow[]).map((row) =>
    fields.map((f) => row[f.table]?.[f.name]),
  );
};

export const isRowDataPacketArray = (
  value: unknown,
): value is RowDataPacket[] => {
  return (
    Array.isArray(value) && (value.length === 0 || !Array.isArray(value[0]))
  );
};

type BuildPagingProps = {
  rowObjects: SqlQueryRow[];
  columnsOrder: string[];
  limit: number;
  offset: number;
};
export const buildPaging = ({
  rowObjects,
  columnsOrder,
  limit,
  offset,
}: BuildPagingProps) => {
  const rowsPlus1 = rowObjects.map((row) =>
    columnsOrder.map((col) => row[col]),
  );

  const hasNext = rowsPlus1.length > limit;
  const hasPrevious = offset > 0;

  return {
    rows: hasNext ? rowsPlus1.slice(0, limit) : rowsPlus1,
    paging: {
      hasNext,
      hasPrevious,
    },
  };
};
