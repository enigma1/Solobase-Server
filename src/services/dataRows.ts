import { escapeId, RowDataPacket } from 'mysql2/promise';

import type {
  ChangedRow,
  SqlColumnsShape,
  SqlTransportRow,
  SessionData,
} from '>/types';

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
  return keyColumns
    .map((column) => {
      const index = columnsOrder.indexOf(column);
      const value = originalRow[index];

      values.push(value);
      return `${escapeId(column)} = ?`;
    })
    .join(' AND ');
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
  return row.originalRow
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
  const selectValues: unknown[] = [];

  const whereClause = buildKeyWhereClause({
    keyColumns: allKeys,
    columnsOrder,
    originalRow,
    values: selectValues,
  });
  const selectQuery = `${selectFirst} ${whereClause}`;
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
