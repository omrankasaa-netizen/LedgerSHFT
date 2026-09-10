import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { prisma } from "../db";
import { validate } from "../middleware/validate";
import { ApiError, asyncHandler } from "../middleware/errorHandler";
import { authenticate, requireRole } from "../middleware/auth";
import { allocateLandedCosts, round2, type AllocationMethod } from "../utils/calculations";
import { createInvoiceParsingService } from "../services/invoiceParsing";

const router = Router();
router.use(authenticate);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const ok = ["application/pdf", "image/png", "image/jpeg", "image/webp"].includes(file.mimetype);
    if (ok) cb(null, true);
    else cb(new ApiError(400, "Only PDF or image files are supported"));
  },
});

const currencySchema = z
  .string()
  .regex(/^[A-Za-z]{3}$/, "Currency must be a 3-letter code (USD, LBP, CNY, EUR…)")
  .transform((v) => v.toUpperCase());

const lineItemSchema = z.object({
  productCode: z.string().trim().max(120).nullish(),
  productName: z.string().trim().min(1, "Product name is required"),
  quantityImported: z.number().positive(),
  unitPurchasePrice: z.number().min(0),
});

const extrasSchema = z.object({
  freightAmount: z.number().min(0).default(0),
  dutyAmount: z.number().min(0).default(0),
  customsFeesAmount: z.number().min(0).default(0),
  otherFeesAmount: z.number().min(0).default(0),
});

const purchaseInvoiceSchema = z
  .object({
    supplierName: z.string().trim().min(1, "Supplier name is required"),
    supplierInvoiceNumber: z.string().trim().max(120).nullish(),
    originCountry: z.string().trim().max(120).nullish(),
    date: z.string().min(4, "Date is required"),
    currency: currencySchema.default("USD"),
    notes: z.string().max(4000).nullish(),
    lineItems: z.array(lineItemSchema).min(1, "Add at least one line item"),
  })
  .merge(extrasSchema);

const recalculateSchema = extrasSchema.extend({
  method: z.enum(["value", "quantity"]).default("value"),
});

const previewSchema = z
  .object({ lineItems: z.array(lineItemSchema).min(1), method: z.enum(["value", "quantity"]).default("value") })
  .merge(extrasSchema);

/** Compute server-side totals + landed-cost allocation for a set of lines. */
function computePurchaseTotals(
  lineItems: z.infer<typeof lineItemSchema>[],
  extras: z.infer<typeof extrasSchema>,
  method: AllocationMethod = "value",
) {
  const result = allocateLandedCosts(lineItems, extras, method);
  return {
    productsSubtotalAmount: result.productsSubtotalAmount,
    totalLandedCostAmount: result.totalLandedCostAmount,
    lines: lineItems.map((l, i) => ({
      ...l,
      linePurchaseTotal: result.lines[i].linePurchaseTotal,
      allocatedUnitLandedCost: result.lines[i].allocatedUnitLandedCost,
      allocatedLineLandedCostTotal: result.lines[i].allocatedLineLandedCostTotal,
    })),
  };
}

// GET /api/purchase-invoices — list newest first, with line items included.
router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const invoices = await prisma.purchaseInvoice.findMany({
      orderBy: { date: "desc" },
      include: { lineItems: true },
    });
    res.json(invoices);
  }),
);

/**
 * POST /api/purchase-invoices/preview-landed-cost
 * Pure calculation: no DB write. The wizard's "Calculate landed cost" button
 * uses this to preview per-unit landed costs before saving.
 */
router.post(
  "/preview-landed-cost",
  asyncHandler(async (req, res) => {
    const body = validate(previewSchema, req.body);
    const result = allocateLandedCosts(body.lineItems, body, body.method);
    res.json(result);
  }),
);

/**
 * POST /api/purchase-invoices/parse-upload
 * Beta: accept a supplier/customs document, run it through the pluggable
 * InvoiceParsingService, and return a candidate purchase invoice for review.
 */
router.post(
  "/parse-upload",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new ApiError(400, "No file uploaded");
    const parser = createInvoiceParsingService();
    const parsed = await parser.parsePurchaseInvoice({
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
      originalName: req.file.originalname,
    });
    res.json(parsed);
  }),
);

// GET /api/purchase-invoices/:id
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const invoice = await prisma.purchaseInvoice.findUnique({
      where: { id: req.params.id },
      include: { lineItems: true },
    });
    if (!invoice) throw new ApiError(404, "Purchase invoice not found");
    res.json(invoice);
  }),
);

// POST /api/purchase-invoices — create with nested line items.
router.post(
  "/",
  requireRole("accountant"),
  asyncHandler(async (req, res) => {
    const body = validate(purchaseInvoiceSchema, req.body);
    const computed = computePurchaseTotals(body.lineItems, body);
    const created = await prisma.purchaseInvoice.create({
      data: {
        supplierName: body.supplierName,
        supplierInvoiceNumber: body.supplierInvoiceNumber ?? null,
        originCountry: body.originCountry ?? null,
        date: new Date(body.date),
        currency: body.currency,
        notes: body.notes ?? null,
        freightAmount: round2(body.freightAmount),
        dutyAmount: round2(body.dutyAmount),
        customsFeesAmount: round2(body.customsFeesAmount),
        otherFeesAmount: round2(body.otherFeesAmount),
        productsSubtotalAmount: computed.productsSubtotalAmount,
        totalLandedCostAmount: computed.totalLandedCostAmount,
        lineItems: { create: computed.lines },
      },
      include: { lineItems: true },
    });
    res.status(201).json(created);
  }),
);

// PUT /api/purchase-invoices/:id — replace header + full line-item set.
router.put(
  "/:id",
  requireRole("accountant"),
  asyncHandler(async (req, res) => {
    const body = validate(purchaseInvoiceSchema, req.body);
    const existing = await prisma.purchaseInvoice.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new ApiError(404, "Purchase invoice not found");

    const computed = computePurchaseTotals(body.lineItems, body);
    const updated = await prisma.$transaction(async (tx) => {
      await tx.purchaseInvoiceLineItem.deleteMany({ where: { purchaseInvoiceId: existing.id } });
      return tx.purchaseInvoice.update({
        where: { id: existing.id },
        data: {
          supplierName: body.supplierName,
          supplierInvoiceNumber: body.supplierInvoiceNumber ?? null,
          originCountry: body.originCountry ?? null,
          date: new Date(body.date),
          currency: body.currency,
          notes: body.notes ?? null,
          freightAmount: round2(body.freightAmount),
          dutyAmount: round2(body.dutyAmount),
          customsFeesAmount: round2(body.customsFeesAmount),
          otherFeesAmount: round2(body.otherFeesAmount),
          productsSubtotalAmount: computed.productsSubtotalAmount,
          totalLandedCostAmount: computed.totalLandedCostAmount,
          lineItems: { create: computed.lines },
        },
        include: { lineItems: true },
      });
    });
    res.json(updated);
  }),
);

/**
 * POST /api/purchase-invoices/:id/recalculate
 * Update the extra cost components and re-allocate landed cost per unit.
 */
router.post(
  "/:id/recalculate",
  requireRole("accountant"),
  asyncHandler(async (req, res) => {
    const body = validate(recalculateSchema, req.body);
    const invoice = await prisma.purchaseInvoice.findUnique({
      where: { id: req.params.id },
      include: { lineItems: true },
    });
    if (!invoice) throw new ApiError(404, "Purchase invoice not found");

    const result = allocateLandedCosts(invoice.lineItems, body, body.method);
    const updated = await prisma.$transaction(async (tx) => {
      for (let i = 0; i < invoice.lineItems.length; i++) {
        await tx.purchaseInvoiceLineItem.update({
          where: { id: invoice.lineItems[i].id },
          data: {
            allocatedUnitLandedCost: result.lines[i].allocatedUnitLandedCost,
            allocatedLineLandedCostTotal: result.lines[i].allocatedLineLandedCostTotal,
          },
        });
      }
      return tx.purchaseInvoice.update({
        where: { id: invoice.id },
        data: {
          freightAmount: round2(body.freightAmount),
          dutyAmount: round2(body.dutyAmount),
          customsFeesAmount: round2(body.customsFeesAmount),
          otherFeesAmount: round2(body.otherFeesAmount),
          totalLandedCostAmount: result.totalLandedCostAmount,
        },
        include: { lineItems: true },
      });
    });
    res.json(updated);
  }),
);

// DELETE /api/purchase-invoices/:id (lines cascade).
router.delete(
  "/:id",
  requireRole("manager"),
  asyncHandler(async (req, res) => {
    const existing = await prisma.purchaseInvoice.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new ApiError(404, "Purchase invoice not found");
    await prisma.purchaseInvoice.delete({ where: { id: existing.id } });
    res.status(204).end();
  }),
);

export default router;
