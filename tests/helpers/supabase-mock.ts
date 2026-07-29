import { vi } from "vitest";

export type SupabaseResult = {
  data?: unknown;
  error?: { message: string } | null;
};

type QueryHandler = (...args: unknown[]) => SupabaseResult | Promise<SupabaseResult>;

export function createQueryBuilder(
  handler?: QueryHandler,
  defaultResult: SupabaseResult = { data: null, error: null }
) {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};

  const resolve = async (...args: unknown[]) => {
    if (handler) {
      return handler(...args);
    }
    return defaultResult;
  };

  const chain = () => builder;

  for (const method of ["select", "eq", "neq", "order", "or", "ilike", "insert", "update", "delete", "in"]) {
    builder[method] = vi.fn(() => chain());
  }

  builder.maybeSingle = vi.fn(async (...args: unknown[]) => resolve("maybeSingle", ...args));
  builder.single = vi.fn(async (...args: unknown[]) => resolve("single", ...args));

  // Thenable support for `await supabase.from(...).select(...)`
  Object.assign(builder, {
    then: (
      onFulfilled?: (value: SupabaseResult) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => resolve("then").then(onFulfilled, onRejected),
  });

  return builder;
}

export function createSupabaseMock(options: {
  from?: Record<string, ReturnType<typeof createQueryBuilder>>;
  auth?: Record<string, ReturnType<typeof vi.fn>>;
}) {
  const fromHandlers = options.from ?? {};
  const authHandlers = options.auth ?? {};

  return {
    from: vi.fn((table: string) => {
      if (!fromHandlers[table]) {
        throw new Error(`Unexpected Supabase table: ${table}`);
      }
      return fromHandlers[table];
    }),
    auth: {
      getUser: authHandlers.getUser ?? vi.fn(),
      admin: {
        createUser: authHandlers.createUser ?? vi.fn(),
        updateUserById: authHandlers.updateUserById ?? vi.fn(),
        inviteUserByEmail: authHandlers.inviteUserByEmail ?? vi.fn(),
      },
    },
  };
}
