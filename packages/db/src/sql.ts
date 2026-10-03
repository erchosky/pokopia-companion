export interface QueryResult<Row extends Record<string, unknown>> {
  readonly rows: readonly Row[];
  readonly rowCount: number;
}

/** Narrow adapter implemented by pg, postgres.js, a Supabase server client, or a test double. */
export interface SqlExecutor {
  query<Row extends Record<string, unknown>>(
    sql: string,
    parameters?: readonly unknown[],
  ): Promise<QueryResult<Row>>;
}

export interface TransactionalSqlExecutor extends SqlExecutor {
  transaction<T>(work: (transaction: SqlExecutor) => Promise<T>): Promise<T>;
}
