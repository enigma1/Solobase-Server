import type { RowDataPacket } from 'mysql2/promise';
import { JSONTypes, JSONObject } from 'type-plus';

export type SqlTransportTypes = JSONTypes;
export type SqlTransportObject = JSONObject;
export type SqlTransportRow = SqlTransportTypes[];

export type SqlTypes = Date | bigint | JSONTypes;
export type SqlObject = { [key in string]?: SqlTypes };
export type SqlRow = SqlTypes[];
