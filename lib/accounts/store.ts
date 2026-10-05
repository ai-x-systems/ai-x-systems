import "server-only";
import { getSupabaseClient } from "@/lib/supabase/client";
import { Account, AccountRole } from "@/types/account";

/**
 * lib/accounts/store.ts
 * ---------------------------------------------------------------------
 * Supabase-backed AccountStore — same interface as before, so nothing
 * elsewhere in the app (routes, pages, session.ts) changes. See
 * supabase/schema.sql for the `accounts` table this reads/writes.
 * ---------------------------------------------------------------------
 */

export interface AccountStore {
  findByEmail(email: string): Promise<Account | undefined>;
  findById(id: string): Promise<Account | undefined>;
  create(input: {
    email: string;
    passwordHash: string;
    role: AccountRole;
    businessId?: string;
  }): Promise<Account>;
  list(): Promise<Account[]>;
  updatePassword(accountId: string, passwordHash: string): Promise<void>;
}

function rowToAccount(row: {
  id: string;
  email: string;
  password_hash: string;
  role: AccountRole;
  business_id: string | null;
  created_at: string;
}): Account {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    role: row.role,
    businessId: row.business_id ?? undefined,
    createdAtISO: row.created_at,
  };
}

export function createSupabaseAccountStore(): AccountStore {
  const supabase = getSupabaseClient();

  return {
    async findByEmail(email) {
      const { data, error } = await supabase
        .from("accounts")
        .select("*")
        .eq("email", email.trim().toLowerCase())
        .maybeSingle();
      if (error) throw error;
      return data ? rowToAccount(data) : undefined;
    },
    async findById(id) {
      const { data, error } = await supabase.from("accounts").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data ? rowToAccount(data) : undefined;
    },
    async create({ email, passwordHash, role, businessId }) {
      const { data, error } = await supabase
        .from("accounts")
        .insert({ email, password_hash: passwordHash, role, business_id: businessId ?? null })
        .select()
        .single();
      if (error) {
        if (error.code === "23505") throw new Error("An account with this email already exists.");
        throw error;
      }
      return rowToAccount(data);
    },
    async list() {
      const { data, error } = await supabase.from("accounts").select("*");
      if (error) throw error;
      return (data ?? []).map(rowToAccount);
    },
    async updatePassword(accountId, passwordHash) {
      const { error } = await supabase
        .from("accounts")
        .update({ password_hash: passwordHash })
        .eq("id", accountId);
      if (error) throw error;
    },
  };
}

export const accountStore: AccountStore = createSupabaseAccountStore();
