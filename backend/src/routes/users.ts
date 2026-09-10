import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "../db";
import { validate } from "../middleware/validate";
import { ApiError, asyncHandler } from "../middleware/errorHandler";
import { authenticate, requireRole } from "../middleware/auth";

const router = Router();
router.use(authenticate);

const ROLES = ["admin", "manager", "accountant", "viewer"] as const;

const createUserSchema = z.object({
  email: z.string().trim().email().transform((v) => v.toLowerCase()),
  name: z.string().trim().min(1, "Name is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(ROLES).default("viewer"),
});

const publicUser = { id: true, email: true, name: true, role: true, createdAt: true } as const;

// GET /api/users — list accounts (managers and above).
router.get(
  "/",
  requireRole("manager"),
  asyncHandler(async (_req, res) => {
    const users = await prisma.user.findMany({ select: publicUser, orderBy: { createdAt: "asc" } });
    res.json(users);
  }),
);

/**
 * POST /api/users — create an account (self-hosted replacement for email
 * invites: the admin sets a password and shares it with the person).
 * Managers can create viewer/accountant; only admins can create manager/admin.
 */
router.post(
  "/",
  requireRole("manager"),
  asyncHandler(async (req, res) => {
    const body = validate(createUserSchema, req.body);
    if ((body.role === "manager" || body.role === "admin") && req.user!.role !== "admin") {
      throw new ApiError(403, "Only admins can create manager or admin accounts");
    }
    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) throw new ApiError(409, "A user with this email already exists");

    const user = await prisma.user.create({
      data: {
        email: body.email,
        name: body.name,
        passwordHash: await bcrypt.hash(body.password, 10),
        role: body.role,
      },
      select: publicUser,
    });
    res.status(201).json(user);
  }),
);

// DELETE /api/users/:id — admin only; you cannot delete yourself.
router.delete(
  "/:id",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    if (req.params.id === req.user!.id) {
      throw new ApiError(400, "You cannot delete your own account");
    }
    const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new ApiError(404, "User not found");
    await prisma.user.delete({ where: { id: existing.id } });
    res.json({ ok: true });
  }),
);

export default router;
