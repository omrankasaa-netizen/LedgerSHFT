import { PrismaClient } from "@prisma/client";

// Single Prisma client shared across the app (avoids connection storms in dev).
export const prisma = new PrismaClient();
