import { v4 as uuidv4 } from 'uuid';
import { FastifyRequest, FastifyReply } from 'fastify';
import { SqlResult } from '@mysql/xdevapi';
import {
  apiCallAuth,
  CommonBaseTableSchema,
  parseColumnType,
} from '>/services';
import type {
  GetTableDetailsRequest,
  GetTableDetailsResponse,
  TableShapeColumn,
  TableShapeKey,
  ColumnsRow,
  KeysRow,
  ForeignRow,
} from '>/types';

export const getTableDetails = async (req: FastifyRequest, rsp: FastifyReply) =>
  apiCallAuth({
    req,
    rsp,
    fn: async (sessionData): Promise<GetTableDetailsResponse> => {
      const request = CommonBaseTableSchema.parse(req.body);
      const { database, table } = request;

      const { xSession } = sessionData;
      // Update selected database in the session
      // const tables = await xSession.getSchema(dbSafeName).getTables();
      const basicSql = `SELECT * FROM information_schema.tables WHERE table_schema = ? and table_name = ?`;
      const colsSql = `SELECT * FROM information_schema.columns WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION`;
      const keysSql = `SELECT * FROM information_schema.statistics WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`;
      const foreignKeysSql = `SELECT * FROM information_schema.key_column_usage WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND REFERENCED_TABLE_NAME IS NOT NULL`;
      // const refsSql = `SELECT * FROM information_schema.referential_constraints WHERE CONSTRAINT_SCHEMA = ? AND TABLE_NAME = ?`;
      const [
        basicQueryResult,
        colsQueryResult,
        keysQueryResult,
        foreignKeysQueryResult,
        // refsQueryResult,
      ] = await Promise.all([
        xSession.sql(basicSql).bind([database, table]).execute(),
        xSession.sql(colsSql).bind([database, table]).execute(),
        xSession.sql(keysSql).bind([database, table]).execute(),
        xSession.sql(foreignKeysSql).bind([database, table]).execute(),
        // xSession.sql(refsSql).bind([database, table]).execute(),
      ]);

      const fetchRows = (result: SqlResult) => {
        const columns = result.getColumns();
        const rows = result.fetchAll() ?? [];
        const names = columns.map((c) => c.getColumnName());
        return rows.map((row) =>
          Object.fromEntries(names.map((name, i) => [name, (row as any)[i]])),
        );
      };
      const [basicRow] = fetchRows(basicQueryResult);
      const colsRows = fetchRows(colsQueryResult) as ColumnsRow[];
      const keysRows = fetchRows(keysQueryResult) as KeysRow[];
      const foreignRows = fetchRows(foreignKeysQueryResult) as ForeignRow[];

      const cols = colsRows.map((col: ColumnsRow): TableShapeColumn => {
        const parsed = parseColumnType(col.COLUMN_TYPE);
        const defaultValue =
          col.COLUMN_DEFAULT === null && col.IS_NULLABLE === 'NO'
            ? undefined
            : col.COLUMN_DEFAULT;

        return {
          field: col.COLUMN_NAME,
          type: parsed.type,
          params: parsed.params,
          nullable: col.IS_NULLABLE === 'YES',
          defaultValue,
          autoIncrement: col.EXTRA?.includes('auto_increment') ?? false,
          unsigned: col.COLUMN_TYPE.includes('unsigned'),
          comment: col.COLUMN_COMMENT,
        };
      });

      // Group Keys
      const keyMap = new Map<string, any[]>();
      for (const row of keysRows) {
        const key = row.INDEX_NAME;
        if (!keyMap.has(key)) keyMap.set(key, []);
        keyMap.get(key)?.push(row);
      }
      const keys: TableShapeKey[] = Array.from(keyMap.entries()).map(
        ([name, rows]) => {
          const first = rows[0];

          const columns = rows
            .sort((a, b) => a.SEQ_IN_INDEX - b.SEQ_IN_INDEX)
            .map((r) => r.COLUMN_NAME);

          const isPrimary = name === 'PRIMARY';

          return {
            type: isPrimary
              ? 'PRIMARY'
              : first.NON_UNIQUE === 0
                ? 'UNIQUE'
                : 'INDEX',
            name: isPrimary ? undefined : name,
            columns,
          };
        },
      );

      // Group foreign Keys
      const fkMap = new Map<string, any[]>();
      for (const row of foreignRows) {
        const key = row.CONSTRAINT_NAME;
        if (!fkMap.has(key)) fkMap.set(key, []);
        fkMap.get(key)!.push(row);
      }
      const foreignKeys = Array.from(fkMap.entries()).map(([name, rows]) => {
        const first = rows[0];

        return {
          type: 'FOREIGN' as const,
          name,
          columns: rows.map((r) => r.COLUMN_NAME),
          references: {
            table: first.REFERENCED_TABLE_NAME,
            columns: rows.map((r) => r.REFERENCED_COLUMN_NAME),
          },
        };
      });

      const signedCols = cols.map((c) => ({ ...c, signature: uuidv4() }));
      const signedKeys = [...keys, ...foreignKeys].map((k) => ({
        ...k,
        signature: uuidv4(),
      }));

      const charset = Object.entries(sessionData.collationsByCharset).find(
        ([_, meta]) => meta.collations.includes(basicRow.TABLE_COLLATION),
      )?.[0];

      const result = {
        ok: true,
        message: `Information retrieved for ${database} -> ${table}`,
        database,
        table,
        engine: basicRow.ENGINE,
        charset: charset ?? '',
        collation: basicRow.TABLE_COLLATION,
        cols: signedCols,
        keys: signedKeys,
      };
      return result;
    },
  });
