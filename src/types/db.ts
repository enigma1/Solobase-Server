import { JSONTypes, JSONObject } from 'type-plus';

export type SqlTransportTypes = JSONTypes;
export type SqlTransportObject = JSONObject;
export type SqlTransportRow = SqlTransportTypes[];

export type SqlTypes = Date | bigint | JSONTypes | null;
export type SqlObject = { [key in string]?: SqlTypes };
export type SqlRow = SqlTypes[];
