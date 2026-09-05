import { prisma } from "@/lib/prisma/client";
import { firstPhone } from "@/lib/whatsapp";

/**
 * Busca un cliente existente por email exacto o por la cola de 8 dígitos del
 * teléfono (el número guardado puede tener otro formato). Evita duplicados
 * al tomar consultas o crear seguimientos.
 */
export async function findClientByContact(email?: string | null, phone?: string | null) {
  const digits = firstPhone(phone).replace(/\D/g, "");
  const or: object[] = [];
  if (email?.trim()) or.push({ email: { equals: email.trim(), mode: "insensitive" } });
  if (digits.length >= 8) or.push({ phone: { contains: digits.slice(-8) } });
  if (!or.length) return null;
  return prisma.client.findFirst({ where: { OR: or }, select: { id: true, name: true, phone: true, email: true } });
}
