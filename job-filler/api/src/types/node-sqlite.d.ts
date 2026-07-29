// Minimal ambient declaration for Node 22 experimental `node:sqlite`.
// Installed @types/node@20.19 lacks these types; remove this shim once
// @types/node is bumped to >=22 (which ships real `node:sqlite` types).
declare module 'node:sqlite' {
  export class StatementSync {
    run(...params: unknown[]): unknown;
    get(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
    iterate(...params: unknown[]): IterableIterator<unknown>;
  }
  export class DatabaseSync {
    constructor(location: string);
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
    close(): void;
  }
}
