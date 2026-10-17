import { Router } from "express";
import { prisma } from "../db";
import { asyncHandler } from "../middleware/errorHandler";
import { authenticate } from "../middleware/auth";
import { computeCustomerBalanceByCurrency, round2 } from "../utils/calculations";

const router = Router();
router.use(authenticate);

/**
 * Group money rows by currency into sorted {currency, amount} rows.
 * Currencies are never summed together — USD + LBP is not a real amount.
 */
function sumByCurrency<T>(
  items: T[],
  currencyOf: (item: T) => string,
  amountOf: (item: T) => number,
): Array<{ currency: string; amount: number }> {
  const map = new Map<string, number>();
  for (const item of items) {
    const cur = currencyOf(item);
    map.set(cur, round2((map.get(cur) ?? 0) + amountOf(item)));
  }
  return [...map.entries()]
    .map(([currency, amount]) => ({ currency, amount }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
}

// GET /api/reports/dashboard — headline KPIs for the dashboard.
router.get(
  "/dashboard",
  asyncHandler(async (_req, res) => {
    const [invoices, payments, customerCount] = await Promise.all([
      prisma.invoice.findMany({ include: { payments: true } }),
      prisma.payment.findMany(),
      prisma.customer.count(),
    ]);
    const monthKey = new Date().toISOString().slice(0, 7);
    // Cancelled invoices are void: they and their linked payments are
    // excluded from every money aggregate.
    const active = invoices.filter((i) => i.status !== "Cancelled");
    const cancelledIds = new Set(
      invoices.filter((i) => i.status === "Cancelled").map((i) => i.id),
    );
    const activePayments = payments.filter((p) => !p.invoiceId || !cancelledIds.has(p.invoiceId));

    // Invoice outstanding nets only same-currency payments — cross-currency
    // settlement needs exchange rates and is never silently netted.
    const outstandingByCurrency = sumByCurrency(
      active,
      (inv) => inv.currency,
      (inv) =>
        Math.max(
          0,
          inv.totalAmount -
            inv.payments
              .filter((p) => p.currency === inv.currency)
              .reduce((ps, p) => ps + p.amount, 0),
        ),
    );
    const collectedThisMonthByCurrency = sumByCurrency(
      activePayments.filter((p) => p.date.toISOString().slice(0, 7) === monthKey),
      (p) => p.currency,
      (p) => p.amount,
    );
    const grossProfitThisMonthByCurrency = sumByCurrency(
      active.filter((i) => i.date.toISOString().slice(0, 7) === monthKey),
      (i) => i.currency,
      (i) => i.grossProfitAmount,
    );

    res.json({
      outstandingByCurrency,
      collectedThisMonthByCurrency,
      grossProfitThisMonthByCurrency,
      totalInvoices: active.length,
      overdueInvoices: active.filter((i) => i.status === "Overdue").length,
      totalCustomers: customerCount,
    });
  }),
);

// GET /api/reports/customer-balances — per-customer balances, per currency.
router.get(
  "/customer-balances",
  asyncHandler(async (_req, res) => {
    const customers = await prisma.customer.findMany({
      include: { invoices: true, payments: true },
      orderBy: { name: "asc" },
    });
    res.json(
      customers.map((c) => ({
        customerId: c.id,
        name: c.name,
        type: c.type,
        city: c.city,
        balances: computeCustomerBalanceByCurrency(c.invoices, c.payments),
      })),
    );
  }),
);

// GET /api/reports/partner-shares — per-partner share due / paid / remaining,
// grouped by invoice currency.
router.get(
  "/partner-shares",
  asyncHandler(async (_req, res) => {
    const partners = await prisma.partner.findMany({
      include: { invoices: { include: { payments: true } } },
      orderBy: { name: "asc" },
    });
    res.json(
      partners.map((p) => {
        // A cancelled sale earns no partner share; its payments don't count as collected.
        const activeInvoices = p.invoices.filter((i) => i.status !== "Cancelled");
        const byCurrency = new Map<string, { shareDue: number; sharePaid: number }>();
        for (const inv of activeInvoices) {
          const row = byCurrency.get(inv.currency) ?? { shareDue: 0, sharePaid: 0 };
          const collected = inv.payments
            .filter((pay) => pay.currency === inv.currency)
            .reduce((ps, pay) => ps + pay.amount, 0);
          const ratio = inv.totalAmount > 0 ? Math.min(1, collected / inv.totalAmount) : 1;
          row.shareDue = round2(row.shareDue + inv.partnerShareAmount);
          row.sharePaid = round2(row.sharePaid + inv.partnerShareAmount * ratio);
          byCurrency.set(inv.currency, row);
        }
        const shares = [...byCurrency.entries()]
          .map(([currency, r]) => ({
            currency,
            shareDue: r.shareDue,
            sharePaid: r.sharePaid,
            remaining: Math.max(0, round2(r.shareDue - r.sharePaid)),
          }))
          .sort((a, b) => a.currency.localeCompare(b.currency));
        return { partnerId: p.id, name: p.name, role: p.role, shares };
      }),
    );
  }),
);

// GET /api/reports/monthly-profit — sales, costs and gross profit per month
// and currency (last 12 months).
router.get(
  "/monthly-profit",
  asyncHandler(async (_req, res) => {
    const since = new Date();
    since.setMonth(since.getMonth() - 11);
    since.setDate(1);

    const invoices = await prisma.invoice.findMany({
      where: { date: { gte: since }, status: { not: "Cancelled" } },
      orderBy: { date: "asc" },
    });

    const months = new Map<
      string,
      { month: string; currency: string; totalSales: number; totalCosts: number; grossProfit: number }
    >();
    for (const inv of invoices) {
      const month = inv.date.toISOString().slice(0, 7);
      const key = `${month}|${inv.currency}`;
      const row = months.get(key) ?? { month, currency: inv.currency, totalSales: 0, totalCosts: 0, grossProfit: 0 };
      row.totalSales = round2(row.totalSales + inv.totalAmount);
      row.totalCosts = round2(row.totalCosts + inv.totalCostAmount);
      row.grossProfit = round2(row.grossProfit + inv.grossProfitAmount);
      months.set(key, row);
    }
    res.json([...months.values()]);
  }),
);

export default router;
