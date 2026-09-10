import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { ApiError, asyncHandler } from "../middleware/errorHandler";
import { authenticate } from "../middleware/auth";

const router = Router();
router.use(authenticate);

const searchSchema = z.object({
  search: z.string().trim().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

/**
 * GET /api/purchase-invoice-line-items?search=
 * Search imported line items by product code or name — used by the
 * "Pick from imports" picker on the sales invoice form.
 */
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { search, limit } = searchSchema.parse(req.query);
    const items = await prisma.purchaseInvoiceLineItem.findMany({
      where: search
        ? {
            OR: [
              { productCode: { contains: search, mode: "insensitive" } },
              { productName: { contains: search, mode: "insensitive" } },
            ],
          }
        : undefined,
      include: {
        purchaseInvoice: {
          select: {
            id: true,
            supplierName: true,
            supplierInvoiceNumber: true,
            date: true,
            currency: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    res.json(items);
  }),
);

export default router;
