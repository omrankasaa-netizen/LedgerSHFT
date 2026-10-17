import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../db";
import { validate } from "../middleware/validate";
import { ApiError, asyncHandler } from "../middleware/errorHandler";
import { authenticate, requireRole, signToken, type AuthUser, type Role } from "../middleware/auth";

const router = Router();

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const registerSchema = credentialsSchema.extend({
  name: z.string().min(1),
  role: z.enum(["admin", "manager", "accountant", "viewer"]).default("viewer"),
});

function toAuthUser(user: { id: string; email: string; name: string; role: string }): AuthUser {
  return { id: user.id, email: user.email, name: user.name, role: user.role as Role };
}

/**
 * In-memory login throttle: max 10 failed attempts per IP per 10 minutes.
 * Sufficient for a single-instance deploy; swap for a store-backed limiter
 * if the app ever runs multiple replicas.
 */
const LOGIN_WINDOW_MS = 10 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 10;
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

/** Throws 429 when the IP has exhausted its attempts inside the window. */
function assertLoginAllowed(ip: string): void {
  const entry = loginAttempts.get(ip);
  if (entry && entry.resetAt > Date.now() && entry.count >= LOGIN_MAX_ATTEMPTS) {
    throw new ApiError(429, "Too many login attempts — try again in a few minutes.");
  }
}

function recordFailedLogin(ip: string): void {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || entry.resetAt <= now) {
    loginAttempts.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
  } else {
    entry.count += 1;
  }
}

/**
 * POST /api/auth/register
 * Creates a user. Open (and forced to admin) only while no users exist —
 * after that only admins can create accounts.
 */
router.post(
  "/register",
  asyncHandler(async (req, res) => {
    const body = validate(registerSchema, req.body);
    const userCount = await prisma.user.count();

    if (userCount > 0) {
      // Bootstrap is over: only an authenticated admin may add users.
      await new Promise<void>((resolve, reject) =>
        authenticate(req, res, (err?: unknown) => (err ? reject(err) : resolve())),
      );
      await new Promise<void>((resolve, reject) =>
        requireRole("admin")(req, res, (err?: unknown) => (err ? reject(err) : resolve())),
      );
    }

    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) throw new ApiError(409, "Email already registered");

    const user = await prisma.user.create({
      data: {
        name: body.name,
        email: body.email,
        passwordHash: await bcrypt.hash(body.password, 10),
        role: userCount === 0 ? "admin" : body.role,
      },
    });
    const authUser = toAuthUser(user);
    res.status(201).json({ token: signToken(authUser), user: authUser });
  }),
);

/** POST /api/auth/login — email + password → JWT. */
router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const ip = req.ip ?? "unknown";
    assertLoginAllowed(ip);
    const body = validate(credentialsSchema, req.body);
    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) {
      recordFailedLogin(ip);
      throw new ApiError(401, "Invalid email or password");
    }
    loginAttempts.delete(ip);
    const authUser = toAuthUser(user);
    res.json({ token: signToken(authUser), user: authUser });
  }),
);

/** GET /api/auth/me — current user from token. */
router.get(
  "/me",
  authenticate,
  asyncHandler(async (req, res) => {
    res.json({ user: req.user });
  }),
);

export default router;
