import { escape, escapeId } from 'mysql2';
import { appErrors } from './errorLayer';
import { TableShapeColumn, TableShapeKey } from '>/types';

const buildColumnType = (col: TableShapeColumn): string => {
  const params = col.params ? Object.values(col.params).join(', ') : '';
  return params ? `${col.type}(${params})` : col.type;
};

const buildDefaultValue = (value: string | null): string => {
  if (value === null) {
    return 'NULL';
  }
  return escape(value);
};

type BuildMode = 'create' | 'edit';
type BuildColumnsTransformerProps = {
  mode?: BuildMode;
  cols: TableShapeColumn[];
};
export const buildColumnsTransformer = ({
  cols,
  mode = 'create',
}: BuildColumnsTransformerProps) => {
  const columns = cols.map((col) => {
    const parts: string[] = [];

    parts.push(escapeId(col.field));
    parts.push(buildColumnType(col));

    if (!col.nullable) {
      parts.push('NOT NULL');
    }

    if (col.defaultValue !== undefined) {
      parts.push(`DEFAULT ${buildDefaultValue(col.defaultValue)}`);
    }

    if (col.autoIncrement) {
      parts.push('AUTO_INCREMENT');
    }

    if (col.comment) {
      parts.push(`COMMENT ${escape(col.comment)}`);
    }
    return parts.join(' ');
  });
  return columns;
};

type BuildKeysTransformerProps = {
  mode?: BuildMode;
  keys: TableShapeKey[];
};

export const buildKeysTransformer = ({
  keys,
  mode = 'create',
}: BuildKeysTransformerProps) => {
  const allKeys = keys.map((key) => {
    const columns = key.columns.map((c) => escapeId(c)).join(', ');

    switch (key.type) {
      case 'PRIMARY':
        return `PRIMARY KEY (${columns})`;

      case 'UNIQUE':
        return `UNIQUE KEY ${escapeId(key.name!)} (${columns})`;

      case 'INDEX':
        return `KEY ${escapeId(key.name!)} (${columns})`;

      case 'FOREIGN':
        return [
          `CONSTRAINT ${escapeId(key.name!)}`,
          `FOREIGN KEY (${columns})`,
          `REFERENCES ${escapeId(key.references!.table)}`,
          `(${key.references!.columns.map((c) => escapeId(c)).join(', ')})`,
        ].join(' ');
    }
  });
  return allKeys;
};

export const buildColumnDefinition = (col: TableShapeColumn) => {
  const parts: string[] = [];

  parts.push(escapeId(col.field));
  let type = col.type;

  if (col.params && Object.keys(col.params).length > 0) {
    type += `(${Object.values(col.params).join(', ')})`;
  }

  parts.push(type);

  if (col.unsigned) {
    parts.push('UNSIGNED');
  }

  if (!col.nullable) {
    parts.push('NOT NULL');
  } else {
    parts.push('NULL');
  }

  if (col.defaultValue !== undefined) {
    if (col.defaultValue === null) {
      parts.push('DEFAULT NULL');
    } else {
      parts.push(`DEFAULT ${escape(col.defaultValue)}`);
    }
  }

  if (col.autoIncrement) {
    parts.push('AUTO_INCREMENT');
  }

  if (col.comment) {
    parts.push(`COMMENT ${escape(col.comment)}`);
  }

  return parts.join(' ');
};

const generateKeyName = (key: TableShapeKey) => {
  switch (key.type) {
    case 'INDEX':
      return `idx_${key.columns.join('_')}`;

    case 'UNIQUE':
      return `uni_${key.columns.join('_')}`;

    case 'FOREIGN':
      return `frn_${key.columns.join('_')}`;

    default:
      return '';
  }
};

export const buildKeyDefinition = (key: TableShapeKey) => {
  const cols = key.columns.map((c) => escapeId(c)).join(', ');
  if (key.type === 'PRIMARY') return `PRIMARY KEY (${cols})`;

  const name = key.name?.trim();
  const autoNamed = name && name.length > 0 ? name : generateKeyName(key);

  switch (key.type) {
    case 'UNIQUE': {
      return `UNIQUE KEY ${escapeId(autoNamed)} (${cols})`;
    }

    case 'INDEX': {
      return `KEY ${escapeId(autoNamed)} (${cols})`;
    }

    case 'FOREIGN': {
      const refCols = key
        .references!.columns.map((c) => escapeId(c))
        .join(', ');

      return [
        `CONSTRAINT ${escapeId(autoNamed)}`,
        `FOREIGN KEY (${cols})`,
        `REFERENCES ${escapeId(key.references!.table)}`,
        `(${refCols})`,
      ].join(' ');
    }
  }
};

export const buildDropKeyDefinition = (key: TableShapeKey) => {
  switch (key.type) {
    case 'PRIMARY':
      return 'DROP PRIMARY KEY';

    case 'UNIQUE':
    case 'INDEX':
      return `DROP INDEX ${escapeId(key.name!)}`;

    case 'FOREIGN':
      return `DROP FOREIGN KEY ${escapeId(key.name!)}`;
  }
};
