import { queryDatabases } from '>/queries';
import { ParameterResolver } from '>/types';

export const resolveDatabase: ParameterResolver = async (params) => {
  const { database } = params;
  if (!database) {
    return false;
  }
  const result = await queryDatabases({
    filters: {
      SCHEMA_NAME: [
        {
          mode: 'where',
          value: params.database,
        },
      ],
    },
    paging: {
      limit: 1,
      offset: 0,
    },
  });

  return result.rowObjects.length > 0;
};
