import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { validate } from "../middleware/validate";
import { ApiError, asyncHandler } from "../middleware/errorHandler";
import { authenticate, requireRole } from "../middleware/auth";
import { computePartnerShareSummary } from "../utils/calculations";

const router = Router();
router.use(authenticate);

const partnerSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  role: z.string().trim().max(60).nullish(),
  defaultShareType: z.enum(["none", "percentage", "fixed_amount"]).default("none"),
  defaultShareValue: z.number().min(0).default(0),
});

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    res.json(await prisma.partner.findMany({ orderBy: { name: "asc" } }));
  }),
);

// GET /api/partners/:id/share-summary — share due, paid (proportional to collections), remaining.
router.get(
  "/:id/share-summary",
  asyncHandler(async (req, res) => {
    const partner = await prisma.partner.findUnique({
      where: { id: req.params.id },
      include: { invoices: { include: { payments: true } } },
    });
    if (!partner) throw new ApiError(404, "Partner not found");

    const paymentsByInvoice = new Map<string, number>();
    partner.invoices.forEach((inv) => {
      paymentsByInvoice.set(inv.id, inv.payments.reduce((s, p) => s + p.amount, 0));
    });
    res.json(
      computePartnerShareSummary(
        partner.invoices,
        paymentsByInvoice,
        partner.invoices.map((i) => i.id),
      ),
    );
  }),
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const partner = await prisma.partner.findUnique({ where: { id: req.params.id } });
    if (!partner) throw new ApiError(404, "Partner not found");
    res.json(partner);
  }),
);

router.post(
  "/",
  requireRole("manager"),
  asyncHandler(async (req, res) => {
    const body = validate(partnerSchema, req.body);
    res.status(201).json(await prisma.partner.create({ data: body }));
  }),
);

router.put(
  "/:id",
  requireRole("manager"),
  asyncHandler(async (req, res) => {
    const body = validate(partnerSchema, req.body);
    const existing = await prisma.partner.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new ApiError(404, "Partner not found");
    res.json(await prisma.partner.update({ where: { id: existing.id }, data: body }));
  }),
);

router.delete(
  "/:id",
  requireRole("manager"),
  asyncHandler(async (req, res) => {
    const existing = await prisma.partner.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new ApiError(404, "Partner not found");
    await prisma.partner.delete({ where: { id: existing.id } });
    res.status(204).end();
  }),
);

export default router;
