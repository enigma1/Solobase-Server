import isEqual from 'lodash-es/isEqual';
import { escapeId, ResultSetHeader } from 'mysql2';
import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  CommonTableSchema,
  apiCallAuth,
  collationExists,
  charsetExists,
  engineExists,
  appErrors,
  buildColumnDefinition,
  buildKeyDefinition,
  buildDropKeyDefinition,
} from '>/services';
import type {
  EditTableResponse,
  EditTableRequest,
  TableShapeColumn,
  TableShapeKey,
} from '>/types';

type ColumnChange = {
  from: TableShapeColumn;
  to: TableShapeColumn;
};

type ColumnDrop = TableShapeColumn;
type ColumnAdd = TableShapeColumn;

type KeyChange = {
  from: TableShapeKey;
  to: TableShapeKey;
};

type KeyDrop = TableShapeKey;
type KeyAdd = TableShapeKey;

const EditTableSchema = z.object({
  original: CommonTableSchema,
  modified: CommonTableSchema,
});

export const editTable = async (req: FastifyRequest, rsp: FastifyReply) =>
  apiCallAuth({
    req,
    rsp,
    fn: async (sessionData): Promise<EditTableResponse> => {
      const request = EditTableSchema.parse(req.body);
      const { original, modified } = request;
      if (original.database !== modified.database) {
        throw appErrors.domain(
          'invalid_table_move',
          'Moving tables between databases is not supported in this operation',
        );
      }

      const defaults = sessionData.defaults;
      const modCharset = modified.charset ?? defaults.charset;
      const modCollation = modified.collation ?? defaults.collation;
      const modEngine = modified.engine ?? defaults.engine;

      const charsetExistsResult = charsetExists({
        session: sessionData,
        charset: modCharset,
      });
      if (!charsetExistsResult) {
        throw appErrors.domain(
          'mod_charset_not_found',
          `Modified character set does not exist`,
        );
      }
      const collationExistsResult = collationExists({
        session: sessionData,
        collation: modCollation,
        charset: modCharset,
      });
      if (!collationExistsResult) {
        throw appErrors.domain(
          'mod_collation_not_found',
          `Modified collation does not exist`,
        );
      }
      const engineExistsResult = engineExists({
        session: sessionData,
        engine: modEngine,
      });
      if (!engineExistsResult) {
        throw appErrors.domain(
          'mod_engine_not_found',
          `Modified engine set is invalid on this server`,
        );
      }

      const { database: db, table, cols, keys } = modified;

      const tableAlterations = [];
      if (original.engine !== modEngine) {
        tableAlterations.push(`ENGINE=${modEngine}`);
      }

      if (original.charset !== modCharset) {
        tableAlterations.push(`DEFAULT CHARACTER SET ${modCharset}`);
      }
      if (original.collation !== modCollation) {
        tableAlterations.push(`COLLATE ${modCollation}`);
      }

      // const dropForeignKeys: string[] = [];
      // const dropIndexes: string[] = [];

      const changeColumns: ColumnChange[] = [];
      const dropColumns: ColumnDrop[] = [];
      const addColumns: ColumnAdd[] = [];

      const changeKeys: KeyChange[] = [];
      const dropKeys: KeyDrop[] = [];
      const addKeys: KeyAdd[] = [];

      // const createIndexes: TableShapeKey[] = [];
      // const createForeignKeys: TableShapeKey[] = [];

      const modTrack = cols.filter((c) => c.signature);
      const modNew = cols.filter((c) => !c.signature);
      const orgBySig = new Map(original.cols.map((c) => [c.signature, c]));
      const modBySig = new Map(modTrack.map((c) => [c.signature, c]));

      const orgKeysBySig = new Map(original.keys.map((k) => [k.signature, k]));
      const modKeysBySig = new Map(keys.map((k) => [k.signature, k]));

      const normalizeColumn = (c: TableShapeColumn) => ({
        field: c.field,
        type: c.type,
        nullable: !!c.nullable,
        defaultValue: c.defaultValue ?? null,
        autoIncrement: !!c.autoIncrement,
        unsigned: !!c.unsigned,
        comment: c.comment ?? '',
      });

      const normalizeKey = (k: TableShapeKey) => ({
        type: k.type,
        name: k.name,
        columns: k.columns,
        references: {
          table: k.references?.table,
          columns: k.references?.columns,
        },
      });

      const isColumnEqual = (a: TableShapeColumn, b: TableShapeColumn) =>
        isEqual(normalizeColumn(a), normalizeColumn(b));

      const isKeyEqual = (a: TableShapeKey, b: TableShapeKey) =>
        isEqual(normalizeKey(a), normalizeKey(b));

      for (const [sig, modCol] of modBySig) {
        const orgCol = orgBySig.get(sig);
        if (!orgCol) continue;

        if (!isColumnEqual(orgCol, modCol)) {
          changeColumns.push({ from: orgCol, to: modCol });
        }
      }

      for (const [sig, orgCol] of orgBySig) {
        if (!modBySig.has(sig)) {
          dropColumns.push(orgCol);
        }
      }

      for (const col of modNew) {
        addColumns.push(col);
      }

      for (const [sig, modKey] of modKeysBySig) {
        const orgKey = orgKeysBySig.get(sig);

        if (!orgKey) {
          addKeys.push(modKey);
          continue;
        }

        if (!isKeyEqual(orgKey, modKey)) {
          changeKeys.push({
            from: orgKey,
            to: modKey,
          });
        }
      }

      for (const [sig, orgKey] of orgKeysBySig) {
        if (!modKeysBySig.has(sig)) {
          dropKeys.push(orgKey);
        }
      }

      const columnDrops = [
        ...dropColumns.map((c) => `DROP COLUMN ${escapeId(c.field)}`),
      ];

      const columnChanges = [
        ...changeColumns.map(
          (c) =>
            `CHANGE COLUMN ${escapeId(c.from.field)} ${buildColumnDefinition(c.to)}`,
        ),
      ];

      const columnAdds = [
        ...addColumns.map((c) => `ADD COLUMN ${buildColumnDefinition(c)}`),
      ];

      const keyDrops = [
        ...dropKeys.map(buildDropKeyDefinition),
        ...changeKeys.map((k) => buildDropKeyDefinition(k.from)),
      ];

      const keyAdditions = [
        ...addKeys.map((k) => `ADD ${buildKeyDefinition(k)}`),
        ...changeKeys.map((k) => `ADD ${buildKeyDefinition(k.to)}`),
      ];

      const alterations = [
        ...keyDrops,
        ...columnDrops,
        ...columnChanges,
        ...columnAdds,
        ...keyAdditions,
        ...tableAlterations,
      ];

      let isUpdated = false;
      if (alterations.length > 0) {
        const [result] = await sessionData.sqlSession.query<ResultSetHeader>(
          `ALTER TABLE ${escapeId(db)}.${escapeId(table)}
          ${alterations.join(',\n')}`,
        );
        isUpdated = result.warningStatus === 0;
      }

      // Rename table as the last operation
      if (original.table !== modified.table) {
        const sql = `ALTER TABLE ${escapeId(db)}.${escapeId(original.table)} RENAME TO ${escapeId(db)}.${escapeId(modified.table)}`;
        const [result] =
          await sessionData.sqlSession.query<ResultSetHeader>(sql);
        isUpdated ||= result.warningStatus === 0;
      }
      // const [result] =
      //   await sessionData.sqlSession.query<ResultSetHeader>(dbQuery);

      // const isUpdated = result.warningStatus === 0;
      return {
        ok: isUpdated,
        database: db,
        table,
        message: isUpdated
          ? `Table ${table} updated successfully in ${db}`
          : `Could not update table ${table}`,
      };
    },
  });
