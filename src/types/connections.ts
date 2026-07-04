export type WorkerConnection<T> = {
  conn: T | null;
  create: () => T | Promise<T>;
};
