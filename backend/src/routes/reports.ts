import { Router } from "express";
import { prisma } from "../db";
import { asyncHandler } from "../middleware/errorHandler";
import { authenticate } from "../middleware/auth";
import { round2 } from "../utils/calculations";

const router = Router();
router.use(authenticate);

/** Sum payments made in the current calendar month. */
function collectedThisMonth(payments: Array<{ date: Date; amount: number }>): number {
  const monthKey = new Date().toISOString().slice(0, 7);
  return round2(
    payments
      .filter((p) => p.date.toISOString().slice(0, 7) === monthKey)
      .reduce((s, p) => s + p.amount, 0),
  );
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

    const totalOutstanding = round2(
      invoices.reduce(
        (s, inv) => s + Math.max(0, inv.totalAmount - inv.payments.reduce((ps, p) => ps + p.amount, 0)),
        0,
      ),
    );
    const profitThisMonth = round2(
      invoices
        .filter((i) => i.date.toISOString().slice(0, 7) === monthKey)
        .reduce((s, i) => s + i.grossProfitAmount, 0),
    );

    res.json({
      totalOutstanding,
      collectedThisMonth: collectedThisMonth(payments),
      grossProfitThisMonth: profitThisMonth,
      totalInvoices: invoices.length,
      overdueInvoices: invoices.filter((i) => i.status === "Overdue").length,
      totalCustomers: customerCount,
    });
  }),
);

// GET /api/reports/customer-balances — per-customer invoiced / paid / outstanding.
router.get(
  "/customer-balances",
  asyncHandler(async (_req, res) => {
    const customers = await prisma.customer.findMany({
      include: { invoices: true, payments: true },
      orderBy: { name: "asc" },
    });
    res.json(
      customers.map((c) => {
        const totalInvoiced = round2(c.invoices.reduce((s, i) => s + i.totalAmount, 0));
        const totalPaid = round2(c.payments.reduce((s, p) => s + p.amount, 0));
        return {
          customerId: c.id,
          name: c.name,
          type: c.type,
          city: c.city,
          totalInvoiced,
          totalPaid,
          outstanding: Math.max(0, round2(totalInvoiced - totalPaid)),
        };
      }),
    );
  }),
);

// GET /api/reports/partner-shares — per-partner share due / paid / remaining.
router.get(
  "/partner-shares",
  asyncHandler(async (_req, res) => {
    const partners = await prisma.partner.findMany({
      include: { invoices: { include: { payments: true } } },
      orderBy: { name: "asc" },
    });
    res.json(
      partners.map((p) => {
        const shareDue = round2(p.invoices.reduce((s, i) => s + i.partnerShareAmount, 0));
        const sharePaid = round2(
          p.invoices.reduce((s, i) => {
            const collected = i.payments.reduce((ps, pay) => ps + pay.amount, 0);
            const ratio = i.totalAmount > 0 ? Math.min(1, collected / i.totalAmount) : 1;
            return s + i.partnerShareAmount * ratio;
          }, 0),
        );
        return {
          partnerId: p.id,
          name: p.name,
          role: p.role,
          shareDue,
          sharePaid,
          remaining: Math.max(0, round2(shareDue - sharePaid)),
        };
      }),
    );
  }),
);

// GET /api/reports/monthly-profit — sales, costs and gross profit per month (last 12).
router.get(
  "/monthly-profit",
  asyncHandler(async (_req, res) => {
    const since = new Date();
    since.setMonth(since.getMonth() - 11);
    since.setDate(1);

    const invoices = await prisma.invoice.findMany({
      where: { date: { gte: since } },
      orderBy: { date: "asc" },
    });

    const months = new Map<string, { month: string; totalSales: number; totalCosts: number; grossProfit: number }>();
    for (const inv of invoices) {
      const key = inv.date.toISOString().slice(0, 7);
      const row = months.get(key) ?? { month: key, totalSales: 0, totalCosts: 0, grossProfit: 0 };
      row.totalSales = round2(row.totalSales + inv.totalAmount);
      row.totalCosts = round2(row.totalCosts + inv.totalCostAmount);
      row.grossProfit = round2(row.grossProfit + inv.grossProfitAmount);
      months.set(key, row);
    }
    res.json([...months.values()]);
  }),
);

export default router;
