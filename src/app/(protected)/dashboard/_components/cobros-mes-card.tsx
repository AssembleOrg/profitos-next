import Link from "next/link";
import { prisma } from "@/lib/prisma/client";
import { formatDate, formatRelative, fromJSDate, now } from "@/lib/datetime";
import {
  RENTAL_DUE_STATUS_LABEL,
  RENTAL_DUE_STATUS_STYLE,
  formatARS,
  getDueEffectiveStatus,
} from "@/lib/rentals";

interface Props {
  daysAhead?: number;
  daysPast?: number;
  limit?: number;
}

export async function CobrosMesCard({
  daysAhead = 30,
  daysPast = 7,
  limit = 8,
}: Readonly<Props> = {}) {
  const today = now().startOf("day");
  const fromDate = today.minus({ days: daysPast }).toJSDate();
  const toDate = today.plus({ days: daysAhead }).toJSDate();

  const dues = await prisma.rentalDueDate.findMany({
    where: {
      dueDate: { gte: fromDate, lte: toDate },
      // Excluir cuotas ya cerradas
      NOT: { status: { in: ["pagado", "condonado"] } },
    },
    include: {
      contract: {
        select: {
          id: true,
          title: true,
          gracePeriodDays: true,
          property: { select: { id: true, address: true } },
          tenant: { select: { id: true, fullName: true } },
        },
      },
      transactions: { select: { amountPaid: true } },
    },
    orderBy: { dueDate: "asc" },
    take: limit * 3, // pull a few extra so el filtro adicional no nos deje vacíos
  });

  // Filtrar por estado efectivo y limitar
  const filtered = dues
    .map((d) => {
      const effective = getDueEffectiveStatus({
        dueDate: d.dueDate,
        status: d.status,
        gracePeriodDays: d.contract.gracePeriodDays,
        expectedAmount: d.expectedAmount,
        collected: d.transactions.reduce((acc, t) => acc + t.amountPaid, 0),
      });
      return { d, effective };
    })
    .filter(({ effective }) => effective !== "pagado" && effective !== "condonado")
    .slice(0, limit);

  // Totales agregados del mes en curso
  const monthStart = today.startOf("month").toJSDate();
  const monthEnd = today.endOf("month").toJSDate();
  const monthDues = await prisma.rentalDueDate.findMany({
    where: { dueDate: { gte: monthStart, lte: monthEnd } },
    select: {
      expectedAmount: true,
      transactions: { select: { amountPaid: true } },
    },
  });
  const monthExpected = monthDues.reduce((acc, d) => acc + d.expectedAmount, 0);
  const monthCollected = monthDues.reduce(
    (acc, d) => acc + d.transactions.reduce((s, t) => s + t.amountPaid, 0),
    0,
  );
  const monthPending = Math.max(0, monthExpected - monthCollected);

  return (
    <section className="flex flex-col rounded-2xl border border-border bg-surface/40 p-5">
      <header className="flex items-center justify-between">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-widest text-text">
            Cobros del mes
          </h3>
          <p className="mt-0.5 text-[11px] text-text-muted">
            Vencimientos pendientes en el rango {daysPast}d atrás → {daysAhead}d adelante
          </p>
        </div>
        <Link
          href="/alquileres?tab=cobros"
          className="rounded-lg border border-border px-3 py-1.5 text-xs text-text-muted transition-colors hover:bg-surface hover:text-text"
        >
          Ver todos
        </Link>
      </header>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <MonthStat label="Esperado" value={formatARS(monthExpected)} />
        <MonthStat label="Cobrado" value={formatARS(monthCollected)} tone="emerald" />
        <MonthStat label="Pendiente" value={formatARS(monthPending)} tone="amber" />
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {filtered.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-bg/30 px-3 py-6 text-center text-xs text-text-muted">
            Sin cobros pendientes en este rango.
          </p>
        ) : (
          filtered.map(({ d, effective }) => {
            const style = RENTAL_DUE_STATUS_STYLE[effective];
            const dt = fromJSDate(d.dueDate).startOf("day");
            const daysAway = Math.round(dt.diff(today, "days").days);
            const distance =
              daysAway < 0
                ? `vencido ${formatRelative(d.dueDate)}`
                : daysAway === 0
                  ? "hoy"
                  : daysAway === 1
                    ? "mañana"
                    : daysAway <= 7
                      ? `en ${daysAway} días`
                      : formatRelative(d.dueDate);
            const collected = d.transactions.reduce((acc, t) => acc + t.amountPaid, 0);
            const pending = d.expectedAmount - collected;
            return (
              <Link
                key={d.id}
                href={`/alquileres?tab=cobros&q=${encodeURIComponent(d.contract.property.address)}`}
                className={`flex items-center gap-3 rounded-xl border bg-bg/40 px-3 py-2.5 transition-colors hover:bg-bg/70 ${effective === "vencido" ? "border-red-500/30 hover:border-red-500/50" : "border-border hover:border-olive-bright/40"}`}
              >
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${style.chip}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text">
                    {d.contract.property.address}
                    {d.contract.title ? ` · ${d.contract.title}` : ""}
                  </p>
                  <p className="truncate text-[11px] text-text-muted">
                    {d.contract.tenant.fullName} · {formatDate(d.dueDate)} · {RENTAL_DUE_STATUS_LABEL[effective]}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-0.5 text-right">
                  <span className="font-mono text-xs text-text">{formatARS(pending)}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[9px] font-medium ${effective === "vencido" ? "bg-red-500/10 text-red-300" : daysAway <= 1 ? "bg-amber-500/10 text-amber-300" : "bg-surface text-text-muted"}`}
                  >
                    {distance}
                  </span>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </section>
  );
}

function MonthStat({ label, value, tone }: { label: string; value: string; tone?: "emerald" | "amber" }) {
  const v = tone === "emerald" ? "text-emerald-300" : tone === "amber" ? "text-amber-300" : "text-text";
  return (
    <div className="flex flex-col gap-0.5 rounded-xl border border-border bg-bg/40 px-3 py-2">
      <span className="text-[9px] font-semibold uppercase tracking-widest text-text-muted">{label}</span>
      <span className={`font-mono text-sm font-semibold ${v}`}>{value}</span>
    </div>
  );
}
