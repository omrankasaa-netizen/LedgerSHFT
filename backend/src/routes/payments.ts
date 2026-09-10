import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { validate } from "../middleware/validate";
import { ApiError, asyncHandler } from "../middleware/errorHandler";
import { authenticate, requireRole } from "../middleware/auth";
import { round2 } from "../utils/calculations";

const router = Router();
router.use(authenticate);

const paymentSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  invoiceId: z.string().nullish(),
  date: z.string().min(4, "Date is required"),
  currency: z.string().regex(/^[A-Za-z]{3}$/).transform((v) => v.toUpperCase()).default("USD"),
  amount: z.number().positive("Amount must be greater than 0"),
  method: z.enum(["cash", "bank_transfer", "cheque", "remittance", "other"]).default("cash"),
  reference: z.string().trim().max(200).nullish(),
  notes: z.string().max(4000).nullish(),
});

/**
 * Recompute a sales invoice's payment-driven status.
 * Draft and Overdue are left alone (manual states); otherwise the status
 * follows how much has been collected.
 */
async function refreshInvoiceStatus(invoiceId: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { payments: true },
  });
  if (!invoice || invoice.status === "Draft" || invoice.status === "Overdue") return;

  const paid = round2(invoice.payments.reduce((s, p) => s + p.amount, 0));
  const status = paid <= 0 ? "Issued" : paid >= invoice.totalAmount ? "Paid" : "Partially Paid";
  if (status !== invoice.status) {
    await prisma.invoice.update({ where: { id: invoice.id }, data: { status } });
  }
}

async function validateRefs(body: z.infer<typeof paymentSchema>) {
  const customer = await prisma.customer.findUnique({ where: { id: body.customerId } });
  if (!customer) throw new ApiError(400, "Customer not found");
  if (body.invoiceId) {
    const invoice = await prisma.invoice.findUnique({ where: { id: body.invoiceId } });
    if (!invoice) throw new ApiError(400, "Invoice not found");
    if (invoice.customerId !== body.customerId) {
      throw new ApiError(400, "Invoice belongs to a different customer");
    }
  }
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const query = z.object({ customerId: z.string().optional(), invoiceId: z.string().optional() }).parse(req.query);
    res.json(
      await prisma.payment.findMany({
        where: { customerId: query.customerId, invoiceId: query.invoiceId },
        orderBy: { date: "desc" },
      }),
    );
  }),
);

router.post(
  "/",
  requireRole("accountant"),
  asyncHandler(async (req, res) => {
    const body = validate(paymentSchema, req.body);
    await validateRefs(body);
    const created = await prisma.payment.create({
      data: { ...body, amount: round2(body.amount), invoiceId: body.invoiceId ?? null, reference: body.reference ?? null, notes: body.notes ?? null },
    });
    if (created.invoiceId) await refreshInvoiceStatus(created.invoiceId);
    res.status(201).json(created);
  }),
);

router.put(
  "/:id",
  requireRole("accountant"),
  asyncHandler(async (req, res) => {
    const body = validate(paymentSchema, req.body);
    const existing = await prisma.payment.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new ApiError(404, "Payment not found");
    await validateRefs(body);
    const updated = await prisma.payment.update({
      where: { id: existing.id },
      data: { ...body, amount: round2(body.amount), invoiceId: body.invoiceId ?? null, reference: body.reference ?? null, notes: body.notes ?? null },
    });
    await refreshInvoiceStatus(updated.invoiceId ?? existing.invoiceId ?? "");
    if (existing.invoiceId && existing.invoiceId !== updated.invoiceId) {
      await refreshInvoiceStatus(existing.invoiceId);
    }
    res.json(updated);
  }),
);

router.delete(
  "/:id",
  requireRole("accountant"),
  asyncHandler(async (req, res) => {
    const existing = await prisma.payment.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new ApiError(404, "Payment not found");
    await prisma.payment.delete({ where: { id: existing.id } });
    if (existing.invoiceId) await refreshInvoiceStatus(existing.invoiceId);
    res.status(204).end();
  }),
);

export default router;
