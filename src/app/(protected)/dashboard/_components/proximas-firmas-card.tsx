import Link from "next/link";
import { prisma } from "@/lib/prisma/client";
import { formatDate, formatRelative, fromJSDate, now } from "@/lib/datetime";
import {
  SIGNATURE_DATE_META,
  SIGNATURE_STATUS_LABEL,
  SIGNATURE_STATUS_STYLE,
  buildUpcomingActions,
  type SignatureStatus,
} from "@/lib/signatures";

interface ProximasFirmasCardProps {
  daysAhead?: number;
  daysPast?: number;
  limit?: number;
}

export async function ProximasFirmasCard({
  daysAhead = 30,
  daysPast = 7,
  limit = 6,
}: Readonly<ProximasFirmasCardProps> = {}) {
  // Pull only proposals that have at least one date set
  const proposals = await prisma.signatureProposal.findMany({
    where: {
      status: { not: "propuesta_rechazada" },
      OR: [
        { dateProcessStarted: { not: null } },
        { dateAgreed: { not: null } },
        { dateKeysHandover: { not: null } },
      ],
    },
    select: {
      id: true,
      status: true,
      dateProcessStarted: true,
      dateAgreed: true,
      dateKeysHandover: true,
      property: { select: { id: true, address: true } },
    },
  });

  const upcoming = buildUpcomingActions(proposals, { daysAhead, daysPast, limit });

  return (
    <section className="flex flex-col rounded-2xl border border-border bg-surface/40 p-5">
      <header className="flex items-center justify-between">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-widest text-text">
            Próximas firmas
          </h3>
          <p className="mt-0.5 text-[11px] text-text-muted">
            Eventos pendientes en los próximos {daysAhead} días
          </p>
        </div>
        <Link
          href="/firmas"
          className="rounded-lg border border-border px-3 py-1.5 text-xs text-text-muted transition-colors hover:bg-surface hover:text-text"
        >
          Ver todas
        </Link>
      </header>

      <div className="mt-4 flex flex-col gap-2">
        {upcoming.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-bg/30 px-3 py-6 text-center text-xs text-text-muted">
            Sin acciones próximas en este rango.
          </p>
        ) : (
          upcoming.map((item) => {
            const meta = SIGNATURE_DATE_META[item.dateField];
            const proposal = proposals.find((p) => p.id === item.proposalId);
            const status = (proposal?.status ?? "propuesta_enviada") as SignatureStatus;
            const statusStyle = SIGNATURE_STATUS_STYLE[status];
            const overdue = item.daysAway < 0;
            const today = now().startOf("day");
            const dt = fromJSDate(new Date(item.date)).startOf("day");
            const distance =
              item.daysAway === 0
                ? "hoy"
                : overdue
                  ? `vencido ${formatRelative(item.date)}`
                  : item.daysAway === 1
                    ? "mañana"
                    : dt.diff(today, "days").days <= 7
                      ? `en ${item.daysAway} días`
                      : formatRelative(item.date);

            return (
              <Link
                key={`${item.proposalId}-${item.dateField}`}
                href={`/firmas?q=${encodeURIComponent(item.propertyAddress)}`}
                className={`flex items-center gap-3 rounded-xl border bg-bg/40 px-3 py-2.5 transition-colors hover:border-olive-bright/40 hover:bg-bg/70 ${overdue ? "border-red-500/30" : "border-border"}`}
              >
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${statusStyle.chip}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${statusStyle.dot}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text">
                    {item.propertyAddress}
                  </p>
                  <p className="truncate text-[11px] text-text-muted">
                    <span className="text-text-faint">{meta.shortLabel}: </span>
                    {formatDate(item.date)} · {SIGNATURE_STATUS_LABEL[status]}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${overdue ? "bg-red-500/10 text-red-300" : item.daysAway <= 1 ? "bg-amber-500/10 text-amber-300" : "bg-surface text-text-muted"}`}
                >
                  {distance}
                </span>
              </Link>
            );
          })
        )}
      </div>
    </section>
  );
}
