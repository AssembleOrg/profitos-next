import { AppError } from "@/lib/api/handler";

/** Valida el body de alta/edición de propietario (locador). */
export function parseOwnerBody(body: Record<string, unknown>, partial = false) {
  const data: {
    fullName?: string;
    idType?: string;
    idNumber?: string | null;
    phone?: string | null;
    email?: string | null;
    notes?: string | null;
  } = {};
  const text = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
  if (!partial || "fullName" in body) {
    const name = text(body.fullName, 120);
    if (!name) throw new AppError(400, "Falta el nombre del propietario");
    data.fullName = name;
  }
  if (!partial || "idType" in body) {
    data.idType = body.idType === "cuit" ? "cuit" : "dni";
  }
  if ("idNumber" in body) data.idNumber = text(body.idNumber, 20);
  if ("phone" in body) data.phone = text(body.phone, 40);
  if ("email" in body) {
    const email = text(body.email, 120);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AppError(400, "Email inválido");
    data.email = email;
  }
  if ("notes" in body) data.notes = text(body.notes, 1000);
  return data;
}
