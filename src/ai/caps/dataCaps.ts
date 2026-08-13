import type { Capability } from '>/types';

export const databasesView: Capability = {
  id: 'databasesView',
  description: 'List databases available on the current database connection.',
  required: [],
};

export const tablesView: Capability = {
  id: 'tablesView',
  description: 'List tables within a database.',
  required: [
    {
      name: 'database',
      description: 'The database containing the tables.',
      type: 'string',
    },
  ],
};

export const tableDataView: Capability = {
  id: 'tableDataView',
  description: 'List data rows from a table within a database.',
  required: [
    {
      name: 'database',
      description: 'The database containing the table.',
      type: 'string',
    },
    {
      name: 'table',
      description: 'The table to retrieve rows from.',
      type: 'string',
    },
  ],
};
