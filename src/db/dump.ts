import mysqlx from '@mysql/xdevapi';

const session = await mysqlx.getSession({
  host: '127.0.0.1',
  port: 33060, // X Plugin
  user: 'root',
  password: '', // or your root password
});

const schema = session.getSchema('ecommerce');
const products = schema.getCollection('products'); // ← use getCollection instead of getTable
const result = await products.find().execute(); // find all documents
const rows = result.fetchAll(); // array of documents
console.log(rows);
await session.close();

// SELECT TABLE_NAME, COLUMN_NAME
// FROM INFORMATION_SCHEMA.COLUMNS
// WHERE TABLE_SCHEMA = 'your_database_name'
//   AND COLUMN_NAME IN ('date_added', 'last_modified');

// -- 1. Temporarily convert columns to VARCHAR
// ALTER TABLE your_table
//   MODIFY COLUMN date_added VARCHAR(64),
//   MODIFY COLUMN last_modified VARCHAR(64);

// -- 2. Convert strings to proper DATETIME
// UPDATE your_table
// SET date_added = STR_TO_DATE(REPLACE(REPLACE(date_added,'T',' '),'Z',''), '%Y-%m-%d %H:%i:%s'),
//     last_modified = STR_TO_DATE(REPLACE(REPLACE(last_modified,'T',' '),'Z',''), '%Y-%m-%d %H:%i:%s');

// -- 3. Convert back to DATETIME
// ALTER TABLE your_table
//   MODIFY COLUMN date_added DATETIME,
//   MODIFY COLUMN last_modified DATETIME;

// SELECT CONCAT(
//   'ALTER TABLE `', TABLE_NAME, '` MODIFY COLUMN date_added VARCHAR(64), MODIFY COLUMN last_modified VARCHAR(64); ',
//   'UPDATE `', TABLE_NAME, '` SET date_added = STR_TO_DATE(REPLACE(REPLACE(date_added,''T'','' ''),''Z'',''''), ''%Y-%m-%d %H:%i:%s''), ',
//   'last_modified = STR_TO_DATE(REPLACE(REPLACE(last_modified,''T'','' ''),''Z'',''''), ''%Y-%m-%d %H:%i:%s''); ',
//   'ALTER TABLE `', TABLE_NAME, '` MODIFY COLUMN date_added DATETIME, MODIFY COLUMN last_modified DATETIME;'
// ) AS fix_statements
// FROM INFORMATION_SCHEMA.COLUMNS
// WHERE TABLE_SCHEMA = 'your_database_name'
//   AND COLUMN_NAME = 'date_added';
