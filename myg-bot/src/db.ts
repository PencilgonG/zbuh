import { PrismaClient } from "@prisma/client";
export const prisma = new PrismaClient();

export async function testConnection() {
  try {
    await prisma.$connect();
    console.log("✅ Connecté à Neon DB via Prisma");
  } catch (err) {
    console.error("❌ Erreur de connexion à la base :", err);
  }
}
