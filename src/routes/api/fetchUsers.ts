import { escapeId, type RowDataPacket } from 'mysql2';
import { FastifyRequest, FastifyReply } from 'fastify';
import { apiCallAuth, getColumnsOrdered } from '>/services';
import type { FetchUsersResponse, SqlRow, SqlColumns } from '>/types';

export const fetchUsers = async (req: FastifyRequest, rsp: FastifyReply) =>
  apiCallAuth({
    req,
    rsp,
    fn: async (sessionData): Promise<FetchUsersResponse> => {
      // const queryResult = await sessionData.xSession
      //   .sql('SELECT * from mysql.user')
      //   .execute();
      //   const rows = queryResult.fetchAll();
      //   const columnsOrder: string[] = [];
      //   const columns = queryResult.getColumns();

      // const cols = indexBy(
      //   columns.map((c): SqlColumns => {
      //     const fieldName = c.getColumnName();
      //     columnsOrder.push(fieldName);
      //     return {
      //       field: fieldName,
      //       type: 'unknown',
      //       nullable: 'YES',
      //       key: '',
      //       defaultValue: null,
      //       extra: '',
      //     };
      //   }),
      //   'field',
      // );

      // const result = {
      //   rows,
      //   cols,
      //   columnsOrder,
      // };
      // return result;

      const { cols, columnsOrder } = await getColumnsOrdered({
        sessionData,
        database: 'mysql',
        table: 'user',
      });
      const queryResult = await sessionData.xSession
        .sql('SELECT * from mysql.user')
        .execute();
      const rows = queryResult.fetchAll();

      // const [sqlRows] =
      //   await sessionData.sqlSession.query<(RowDataPacket & SqlRow)[]>(sql);
      // const rows = sqlRows.map((row) => columnsOrder.map((col) => row[col]));

      const result = {
        ok: true,
        rows,
        cols,
        columnsOrder,
        message: 'Users successfully retrieved',
      };
      return result;
    },
  });
