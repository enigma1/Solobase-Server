import { databasesView, tablesView, tableDataView } from '>/ai/caps';
import { Capability } from '>/types';

export const dataCapabilities: Capability[] = [
  databasesView,
  tablesView,
  tableDataView,
];

export const capabilityRoutes = {
  databasesView: 'databases',
  tablesView: 'tables',
} as const;
