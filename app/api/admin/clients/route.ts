import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/accounts/session";
import { accountStore } from "@/lib/accounts/store";
import { creditLedger } from "@/lib/billing/credits";
import { listStoredBusinesses } from "@/lib/config/business-store";

export const runtime = "nodejs";

/**
 * The single "all clients in one place" admin view: joins account (login),
 * business config (industry/name/demo status), and credit balance for
 * every client account. Nothing here is a native DB join — it's three
 * small local-dev stores read and stitched together, which is fine at the
 * client counts this business will have for a long while.
 */
export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Admin access required." }, { status: 403 });
  }

  const accounts = await accountStore.list();
  const stored = new Map((await listStoredBusinesses()).map((b) => [b.config.id, b]));
  const clients = await Promise.all(
    accounts
      .filter((a) => a.role === "client" && a.businessId)
      .map(async (a) => {
        const business = stored.get(a.businessId!)?.config;
        const balance = await creditLedger.getBalance(a.businessId!);
        return {
          accountId: a.id,
          email: a.email,
          businessId: a.businessId,
          businessName: business?.name ?? "(unknown business)",
          industry: business?.industry,
          demo: business?.demo ?? false,
          creditBalance: balance.balance,
          createdAtISO: a.createdAtISO,
        };
      })
  );

  return NextResponse.json({ success: true, clients });
}
