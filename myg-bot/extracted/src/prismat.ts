// src/lib/prisma.ts
import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __PRISMA__: PrismaClient | undefined;
}

/**
 * Client Prisma singleton (évite les multiples connexions en dev).
 */
export const prisma =
  global.__PRISMA__ ??
  new PrismaClient({
    log: process.env.NODE_ENV === "production" ? ["error"] : ["query", "error", "warn"],
  });

if (process.env.NODE_ENV !== "production") {
  global.__PRISMA__ = prisma;
}
