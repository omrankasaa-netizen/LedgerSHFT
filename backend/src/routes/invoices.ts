import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { validate } from "../middleware/validate";
import { ApiError, asyncHandler } from "../middleware/errorHandler";
import { authenticate, requireRole } from "../middleware/auth";
import { computeInvoiceTotals, round2, type PartnerShareRule } from "../utils/calculations";

const router = Router();
router.use(authenticate);

const INVOICE_STATUSES = ["Draft", "Issued", "Partially Paid", "Paid", "Overdue"] as const;

const lineItemSchema = z.object({
  productName: z.string().trim().optional(),
  productCode: z.string().trim().max(120).nullish(),
  quantity: z.number().positive(),
  unitPrice: z.number().min(0),
  /** Manual unit cost — ignored when purchaseInvoiceLineItemId is set. */
  unitCost: z.number().min(0).nullish(),
  /** Link to an import line: unit cost comes from its landed cost. */
  purchaseInvoiceLineItemId: z.string().nullish(),
});

const invoiceSchema = z.object({
  invoiceNumber: z.string().trim().max(120).nullish(),
  customerId: z.string().min(1, "Customer is required"),
  partnerId: z.string().nullish(),
  date: z.string().min(4, "Date is required"),
  currency: z.string().regex(/^[A-Za-z]{3}$/).transform((v) => v.toUpperCase()).default("USD"),
  discountAmount: z.number().min(0).default(0),
  taxAmount: z.number().min(0).default(0),
  status: z.enum(INVOICE_STATUSES).default("Draft"),
  notes: z.string().max(4000).nullish(),
  lineItems: z.array(lineItemSchema).min(1, "Add at least one line item"),
});

type LineInput = z.infer<typeof lineItemSchema>;

/**
 * Resolve the authoritative cost for each line.
 * Lines linked to an import get their unit cost from the purchase invoice's
 * allocatedUnitLandedCost (never from the client); product name/code are
 * filled from the import line when left blank.
 */
async function resolveLines(lines: LineInput[]) {
  return Promise.all(
    lines.map(async (line) => {
      let productName = line.productName?.trim() ?? "";
      let productCode = line.productCode ?? null;
      let unitCost = line.unitCost ?? null;

      if (line.purchaseInvoiceLineItemId) {
        const importLine = await prisma.purchaseInvoiceLineItem.findUnique({
          where: { id: line.purchaseInvoiceLineItemId },
        });
        if (!importLine) throw new ApiError(400, "Linked import line item not found");
        unitCost = importLine.allocatedUnitLandedCost ?? importLine.unitPurchasePrice;
        if (!productName) productName = importLine.productName;
        if (!productCode) productCode = importLine.productCode;
      }
      if (!productName) throw new ApiError(400, "Each line item needs a product name");

      return {
        productName,
        productCode,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        lineTotal: round2(line.quantity * line.unitPrice),
        unitCost,
        lineCostTotal: unitCost == null ? null : round2(line.quantity * unitCost),
        purchaseInvoiceLineItemId: line.purchaseInvoiceLineItemId ?? null,
      };
    }),
  );
}

async function loadPartnerRule(partnerId?: string | null): Promise<PartnerShareRule | null> {
  if (!partnerId) return null;
  const partner = await prisma.partner.findUnique({ where: { id: partnerId } });
  if (!partner) throw new ApiError(400, "Partner not found");
  return { defaultShareType: partner.defaultShareType, defaultShareValue: partner.defaultShareValue };
}

// GET /api/invoices?status=&customerId=&from=&to=
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const query = z
      .object({
        status: z.enum(INVOICE_STATUSES).optional(),
        customerId: z.string().optional(),
        from: z.string().optional(),
        to: z.string().optional(),
      })
      .parse(req.query);

    const invoices = await prisma.invoice.findMany({
      where: {
        status: query.status,
        customerId: query.customerId,
        date: {
          gte: query.from ? new Date(query.from) : undefined,
          lte: query.to ? new Date(query.to) : undefined,
        },
      },
      orderBy: { date: "desc" },
      include: { lineItems: true, payments: true },
    });
    res.json(invoices);
  }),
);

// GET /api/invoices/:id
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id },
      include: { lineItems: true, payments: true },
    });
    if (!invoice) throw new ApiError(404, "Invoice not found");
    res.json(invoice);
  }),
);

// POST /api/invoices — totals are always recomputed server-side.
router.post(
  "/",
  requireRole("accountant"),
  asyncHandler(async (req, res) => {
    const body = validate(invoiceSchema, req.body);
    const customer = await prisma.customer.findUnique({ where: { id: body.customerId } });
    if (!customer) throw new ApiError(400, "Customer not found");

    const lines = await resolveLines(body.lineItems);
    const partner = await loadPartnerRule(body.partnerId);
    const totals = computeInvoiceTotals(lines, body.discountAmount, body.taxAmount, partner);

    const created = await prisma.invoice.create({
      data: {
        invoiceNumber: body.invoiceNumber ?? null,
        customerId: body.customerId,
        partnerId: body.partnerId ?? null,
        date: new Date(body.date),
        currency: body.currency,
        discountAmount: round2(body.discountAmount),
        taxAmount: round2(body.taxAmount),
        status: body.status,
        notes: body.notes ?? null,
        ...totals,
        lineItems: { create: lines },
      },
      include: { lineItems: true },
    });
    res.status(201).json(created);
  }),
);

// PUT /api/invoices/:id — replace header + full line-item set.
router.put(
  "/:id",
  requireRole("accountant"),
  asyncHandler(async (req, res) => {
    const body = validate(invoiceSchema, req.body);
    const existing = await prisma.invoice.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new ApiError(404, "Invoice not found");

    const lines = await resolveLines(body.lineItems);
    const partner = await loadPartnerRule(body.partnerId);
    const totals = computeInvoiceTotals(lines, body.discountAmount, body.taxAmount, partner);

    const updated = await prisma.$transaction(async (tx) => {
      await tx.invoiceLineItem.deleteMany({ where: { invoiceId: existing.id } });
      return tx.invoice.update({
        where: { id: existing.id },
        data: {
          invoiceNumber: body.invoiceNumber ?? null,
          customerId: body.customerId,
          partnerId: body.partnerId ?? null,
          date: new Date(body.date),
          currency: body.currency,
          discountAmount: round2(body.discountAmount),
          taxAmount: round2(body.taxAmount),
          status: body.status,
          notes: body.notes ?? null,
          ...totals,
          lineItems: { create: lines },
        },
        include: { lineItems: true },
      });
    });
    res.json(updated);
  }),
);

// PATCH /api/invoices/:id/status — lightweight status change without resending lines.
router.patch(
  "/:id/status",
  requireRole("accountant"),
  asyncHandler(async (req, res) => {
    const body = validate(z.object({ status: z.enum(INVOICE_STATUSES) }), req.body);
    const existing = await prisma.invoice.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new ApiError(404, "Invoice not found");
    const updated = await prisma.invoice.update({
      where: { id: existing.id },
      data: { status: body.status },
      include: { lineItems: true, payments: true },
    });
    res.json(updated);
  }),
);

// DELETE /api/invoices/:id
router.delete(
  "/:id",
  requireRole("manager"),
  asyncHandler(async (req, res) => {
    const existing = await prisma.invoice.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new ApiError(404, "Invoice not found");
    await prisma.invoice.delete({ where: { id: existing.id } });
    res.status(204).end();
  }),
);

export default router;
