/**
 * Normaliza un celular argentino a 549 + 10 dígitos, listo para wa.me.
 * Acepta "11 5385-4029", "011 15 5385 4029" y "+54 9 11 5385 4029".
 */
export function normalizeArgentinePhone(raw: string): string | null {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("54")) digits = digits.slice(2);
  if (digits.startsWith("9") && digits.length === 11) digits = digits.slice(1);
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length === 12) {
    // El "15" va después de la característica, que tiene de 2 a 4 dígitos.
    for (const areaLength of [2, 3, 4]) {
      if (digits.slice(areaLength, areaLength + 2) === "15") {
        digits = digits.slice(0, areaLength) + digits.slice(areaLength + 2);
        break;
      }
    }
  }
  return digits.length === 10 ? `549${digits}` : null;
}

export function formatArgentinePhone(stored: string): string {
  const national = stored.replace(/^549/, "");
  return national.length === 10 ? `${national.slice(0, 2)} ${national.slice(2, 6)} ${national.slice(6)}` : stored;
}
