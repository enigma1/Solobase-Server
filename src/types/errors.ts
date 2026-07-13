import { ZodError } from 'zod';
import { MySqlError } from './mysql';

export type AppError =
  | { type: 'auth'; kind: 'missing' | 'invalid' }
  | { type: 'mysql'; error: MySqlError }
  | { type: 'validation'; error: ZodError }
  | { type: 'domain'; code: string; message: string }
  | { type: 'server'; code: number; message: string };
