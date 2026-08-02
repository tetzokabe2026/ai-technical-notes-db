import { randomBytes, randomUUID } from "node:crypto";

type Row = Record<string, unknown>;

type Store = {
  seeded: boolean;
  tables: {
    app_users: Row[];
    categories: Row[];
    technical_notes: Row[];
  };
  authPasswordByEmail: Map<string, string>;
  authUserById: Map<string, { id: string; email: string }>;
  accessTokens: Map<string, string>; // token -> auth user id
  refreshTokens: Map<string, string>; // token -> auth user id
};

type MaybeSingleResult = { data: Row | null; error: null };
type SingleResult = { data: Row; error: null } | { data: null; error: { message: string } };
type ListResult = { data: Row[]; error: null };

const TABLES_WITH_CATEGORY_JOIN = new Set(["technical_notes"]);

let store: Store | null = null;

function getStore(): Store {
  if (!store) {
    store = {
      seeded: false,
      tables: { app_users: [], categories: [], technical_notes: [] },
      authPasswordByEmail: new Map(),
      authUserById: new Map(),
      accessTokens: new Map(),
      refreshTokens: new Map(),
    };
  }
  return store;
}

export function resetDemoMemoryStoreForTests(): void {
  store = null;
}

function ensureSeeded(): void {
  const s = getStore();
  if (s.seeded) return;
  const email = process.env.DEMO_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.DEMO_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error("DEMO_ADMIN_EMAIL and DEMO_ADMIN_PASSWORD are required in memory mode.");
  }
  const now = new Date().toISOString();
  s.authUserById.set("demo-auth-user-id", { id: "demo-auth-user-id", email });
  s.authPasswordByEmail.set(email, password);
  s.tables.app_users.push({
    id: "demo-app-user-id",
    auth_user_id: "demo-auth-user-id",
    email,
    user_id: "demo-admin",
    role: "admin",
    status: "approved",
    last_login_at: null,
    created_at: now,
    updated_at: now,
  });
  s.tables.categories.push({
    id: "demo-category-finance-id",
    owner_user_id: "demo-app-user-id",
    name: "Finance",
    parent_id: null,
    description: null,
    ai_generated: false,
    created_at: now,
    updated_at: now,
  });
  s.seeded = true;
}

function generateToken(prefix: "demo-access" | "demo-refresh"): string {
  return `${prefix}-${randomBytes(16).toString("hex")}`;
}

function attachCategory(table: string, row: Row): Row {
  if (!TABLES_WITH_CATEGORY_JOIN.has(table)) return row;
  const s = getStore();
  const categoryId = row.category_id as string | null | undefined;
  const category = categoryId
    ? (s.tables.categories.find((c) => c.id === categoryId) ?? null)
    : null;
  return {
    ...row,
    categories: category ? { id: category.id, name: category.name } : null,
  };
}

function withProjection(table: string, rows: Row[], selectExpr?: string): Row[] {
  const wantsCategoryJoin = !!selectExpr && /categories\s*\(/.test(selectExpr);
  if (wantsCategoryJoin) {
    return rows.map((row) => attachCategory(table, row));
  }
  return rows;
}

type Filter = { type: "eq" | "neq"; field: string; value: unknown } | { type: "in"; field: string; values: unknown[] } | { type: "ilike"; field: string; pattern: string } | { type: "or"; expr: string };

function ilikeToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*");
  return new RegExp(`^${escaped}$`, "i");
}

function matchesFilter(row: Row, filter: Filter): boolean {
  switch (filter.type) {
    case "eq":
      return row[filter.field] === filter.value;
    case "neq":
      return row[filter.field] !== filter.value;
    case "in":
      return filter.values.includes(row[filter.field]);
    case "ilike": {
      const value = row[filter.field];
      if (typeof value !== "string") return false;
      return ilikeToRegExp(filter.pattern).test(value);
    }
    case "or": {
      // Parse simple "field.ilike.%q%,field2.ilike.%q%" clauses; unknown clauses are ignored (treated as non-matching).
      const clauses = filter.expr.split(",");
      return clauses.some((clause) => {
        const match = /^([^.]+)\.ilike\.(.*)$/.exec(clause.trim());
        if (!match) return false;
        const [, field, pattern] = match;
        const value = row[field];
        if (typeof value !== "string") return false;
        return ilikeToRegExp(pattern).test(value);
      });
    }
    default:
      return true;
  }
}

class QueryBuilder implements PromiseLike<ListResult> {
  private filters: Filter[] = [];
  private pendingInsert: Row[] | null = null;
  private pendingUpdate: Row | null = null;
  private pendingDelete = false;
  private selectExpr: string | undefined;
  private orderField: string | null = null;
  private orderAscending = true;

  constructor(
    private readonly table: keyof Store["tables"],
  ) {}

  select(expr?: string): this {
    this.selectExpr = expr;
    return this;
  }

  insert(row: Row | Row[]): this {
    this.pendingInsert = Array.isArray(row) ? row : [row];
    return this;
  }

  update(patch: Row): this {
    this.pendingUpdate = patch;
    return this;
  }

  delete(): this {
    this.pendingDelete = true;
    return this;
  }

  eq(field: string, value: unknown): this {
    this.filters.push({ type: "eq", field, value });
    return this;
  }

  neq(field: string, value: unknown): this {
    this.filters.push({ type: "neq", field, value });
    return this;
  }

  in(field: string, values: unknown[]): this {
    this.filters.push({ type: "in", field, values });
    return this;
  }

  ilike(field: string, pattern: string): this {
    this.filters.push({ type: "ilike", field, pattern });
    return this;
  }

  or(expr: string): this {
    this.filters.push({ type: "or", expr });
    return this;
  }

  order(field: string, options?: { ascending?: boolean }): this {
    this.orderField = field;
    this.orderAscending = options?.ascending ?? true;
    return this;
  }

  private tableRows(): Row[] {
    return getStore().tables[this.table];
  }

  private applyFilters(rows: Row[]): Row[] {
    return rows.filter((row) => this.filters.every((filter) => matchesFilter(row, filter)));
  }

  private applyOrder(rows: Row[]): Row[] {
    if (!this.orderField) return rows;
    const field = this.orderField;
    const sorted = [...rows].sort((a, b) => {
      const av = a[field];
      const bv = b[field];
      if (av === bv) return 0;
      if (av === undefined || av === null) return this.orderAscending ? -1 : 1;
      if (bv === undefined || bv === null) return this.orderAscending ? 1 : -1;
      return av < bv ? -1 : 1;
    });
    return this.orderAscending ? sorted : sorted.reverse();
  }

  private runInsert(): Row[] {
    const now = new Date().toISOString();
    const inserted = (this.pendingInsert ?? []).map((row) => {
      const full: Row = {
        id: randomUUID(),
        created_at: now,
        updated_at: now,
        ...row,
      };
      return full;
    });
    this.tableRows().push(...inserted);
    return inserted;
  }

  private runUpdate(): Row[] {
    const now = new Date().toISOString();
    const rows = this.tableRows();
    const matched = this.applyFilters(rows);
    const patch = this.pendingUpdate ?? {};
    for (const row of matched) {
      Object.assign(row, patch, { updated_at: now });
    }
    return matched;
  }

  private runDelete(): Row[] {
    const rows = this.tableRows();
    const matched = this.applyFilters(rows);
    const remaining = rows.filter((row) => !matched.includes(row));
    getStore().tables[this.table] = remaining as never;
    return matched;
  }

  private resolveRows(): Row[] {
    if (this.pendingInsert) return this.runInsert();
    if (this.pendingUpdate) return this.runUpdate();
    if (this.pendingDelete) return this.runDelete();
    return this.applyOrder(this.applyFilters(this.tableRows()));
  }

  async maybeSingle(): Promise<MaybeSingleResult> {
    const rows = withProjection(this.table, this.resolveRows(), this.selectExpr);
    return { data: rows[0] ?? null, error: null };
  }

  async single(): Promise<SingleResult> {
    const rows = withProjection(this.table, this.resolveRows(), this.selectExpr);
    if (rows.length === 0) {
      return { data: null, error: { message: "No rows found" } };
    }
    return { data: rows[0], error: null };
  }

  then<TResult1 = ListResult, TResult2 = never>(
    onfulfilled?: ((value: ListResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    const rows = withProjection(this.table, this.resolveRows(), this.selectExpr);
    const result: ListResult = { data: rows, error: null };
    return Promise.resolve(result).then(onfulfilled, onrejected);
  }
}

export type DemoMemoryClient = {
  from: (table: string) => QueryBuilder;
  auth: {
    signInWithPassword: (credentials: { email: string; password: string }) => Promise<{
      data: { session: { access_token: string; refresh_token: string; expires_in: number } | null; user: { id: string; email: string } | null };
      error: { message: string } | null;
    }>;
    getUser: (jwt?: string) => Promise<{
      data: { user: { id: string; email: string } | null };
      error: { message: string } | null;
    }>;
    refreshSession: (params: { refresh_token: string }) => Promise<{
      data: { session: { access_token: string; refresh_token: string; expires_in: number } | null; user: { id: string; email: string } | null };
      error: { message: string } | null;
    }>;
  };
};

export function createDemoMemorySupabase(): DemoMemoryClient {
  ensureSeeded();
  const s = getStore();

  return {
    from(table: string) {
      return new QueryBuilder(table as keyof Store["tables"]);
    },
    auth: {
      async signInWithPassword({ email, password }) {
        const normalizedEmail = email.trim().toLowerCase();
        const storedPassword = s.authPasswordByEmail.get(normalizedEmail);
        const authUser = [...s.authUserById.values()].find((u) => u.email === normalizedEmail);
        if (!storedPassword || !authUser || storedPassword !== password) {
          return {
            data: { session: null, user: null },
            error: { message: "Invalid login credentials" },
          };
        }
        const accessToken = generateToken("demo-access");
        const refreshToken = generateToken("demo-refresh");
        s.accessTokens.set(accessToken, authUser.id);
        s.refreshTokens.set(refreshToken, authUser.id);
        return {
          data: {
            session: { access_token: accessToken, refresh_token: refreshToken, expires_in: 3600 },
            user: { id: authUser.id, email: authUser.email },
          },
          error: null,
        };
      },
      async getUser(jwt?: string) {
        if (!jwt) {
          return { data: { user: null }, error: { message: "No token provided" } };
        }
        const authUserId = s.accessTokens.get(jwt);
        const authUser = authUserId ? s.authUserById.get(authUserId) : undefined;
        if (!authUser) {
          return { data: { user: null }, error: { message: "Invalid token" } };
        }
        return { data: { user: { id: authUser.id, email: authUser.email } }, error: null };
      },
      async refreshSession({ refresh_token }) {
        const authUserId = s.refreshTokens.get(refresh_token);
        const authUser = authUserId ? s.authUserById.get(authUserId) : undefined;
        if (!authUser) {
          return { data: { session: null, user: null }, error: { message: "Invalid refresh token" } };
        }
        const accessToken = generateToken("demo-access");
        s.accessTokens.set(accessToken, authUser.id);
        return {
          data: {
            session: { access_token: accessToken, refresh_token, expires_in: 3600 },
            user: { id: authUser.id, email: authUser.email },
          },
          error: null,
        };
      },
    },
  };
}
