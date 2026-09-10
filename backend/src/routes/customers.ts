import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { validate } from "../middleware/validate";
import { ApiError, asyncHandler } from "../middleware/errorHandler";
import { authenticate, requireRole } from "../middleware/auth";
import { computeCustomerBalance } from "../utils/calculations";

const router = Router();
router.use(authenticate);

const customerSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  type: z.string().trim().max(60).nullish(),
  city: z.string().trim().max(120).nullish(),
  phone: z.string().trim().max(60).nullish(),
  email: z.string().email().nullish().or(z.literal("")),
  notes: z.string().max(4000).nullish(),
});

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    res.json(await prisma.customer.findMany({ orderBy: { name: "asc" } }));
  }),
);

// GET /api/customers/:id/balance — invoiced / paid / outstanding.
router.get(
  "/:id/balance",
  asyncHandler(async (req, res) => {
    const customer = await prisma.customer.findUnique({
      where: { id: req.params.id },
      include: { invoices: true, payments: true },
    });
    if (!customer) throw new ApiError(404, "Customer not found");
    res.json(computeCustomerBalance(customer.invoices, customer.payments));
  }),
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const customer = await prisma.customer.findUnique({ where: { id: req.params.id } });
    if (!customer) throw new ApiError(404, "Customer not found");
    res.json(customer);
  }),
);

router.post(
  "/",
  requireRole("accountant"),
  asyncHandler(async (req, res) => {
    const body = validate(customerSchema, req.body);
    res.status(201).json(await prisma.customer.create({ data: { ...body, email: body.email || null } }));
  }),
);

router.put(
  "/:id",
  requireRole("accountant"),
  asyncHandler(async (req, res) => {
    const body = validate(customerSchema, req.body);
    const existing = await prisma.customer.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new ApiError(404, "Customer not found");
    res.json(await prisma.customer.update({ where: { id: existing.id }, data: { ...body, email: body.email || null } }));
  }),
);

router.delete(
  "/:id",
  requireRole("manager"),
  asyncHandler(async (req, res) => {
    const existing = await prisma.customer.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new ApiError(404, "Customer not found");
    await prisma.customer.delete({ where: { id: existing.id } });
    res.status(204).end();
  }),
);

export default router;
