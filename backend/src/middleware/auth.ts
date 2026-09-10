import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { ApiError } from "./errorHandler";

export type Role = "admin" | "manager" | "accountant" | "viewer";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signToken(user: AuthUser): string {
  return jwt.sign(
    { sub: user.id, email: user.email, name: user.name, role: user.role },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn } as jwt.SignOptions,
  );
}

/** Require a valid Bearer token; attaches req.user. */
export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return next(new ApiError(401, "Missing authorization token"));
  try {
    const payload = jwt.verify(token, config.jwtSecret) as jwt.JwtPayload;
    req.user = {
      id: String(payload.sub),
      email: String(payload.email),
      name: String(payload.name),
      role: payload.role as Role,
    };
    next();
  } catch {
    next(new ApiError(401, "Invalid or expired token"));
  }
}

const ROLE_RANK: Record<Role, number> = { viewer: 0, accountant: 1, manager: 2, admin: 3 };

/**
 * Role-based access control. Pass the minimum role required, e.g.
 * requireRole("manager") allows manager + admin.
 */
export function requireRole(minRole: Role) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new ApiError(401, "Not authenticated"));
    if (ROLE_RANK[req.user.role] < ROLE_RANK[minRole]) {
      return next(new ApiError(403, "Insufficient permissions"));
    }
    next();
  };
}
