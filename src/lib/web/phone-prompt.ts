export type PhonePrompt = "first" | "reminder" | null;

const REMINDER_INTERVAL_DAYS = 14;
const MAX_ASKS = 4;

/**
 * Primera vez: se pide el teléfono en una hoja que se puede saltear. Después, un
 * aviso chico cada dos semanas y nunca más de cuatro veces en total.
 */
export function phonePromptFor(
  visitor: { phone: string | null; phoneAskCount: number; phoneLastAskedAt: Date | null },
  now = new Date(),
): PhonePrompt {
  if (visitor.phone) return null;
  if (visitor.phoneAskCount === 0) return "first";
  if (visitor.phoneAskCount >= MAX_ASKS || !visitor.phoneLastAskedAt) return null;
  const elapsedDays = (now.getTime() - visitor.phoneLastAskedAt.getTime()) / 86_400_000;
  return elapsedDays >= REMINDER_INTERVAL_DAYS ? "reminder" : null;
}
