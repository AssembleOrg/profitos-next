import Link from "next/link";
import { ExploreLink } from "./explore-link";
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
    <section className="flex flex-col rounded-[20px] border border-border bg-surface p-4 md:p-5">
      <header className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-base font-semibold text-text">
            Próximas firmas
          </h3>
          <p className="mt-0.5 text-[11.5px] text-text-faint">
            Eventos pendientes en los próximos {daysAhead} días
          </p>
        </div>
        <ExploreLink href="/firmas" />
      </header>

      <div className="mt-4 flex flex-col gap-2">
        {upcoming.length === 0 ? (
          <p className="rounded-[14px] bg-bg px-3 py-6 text-center text-[12.5px] text-text-faint">
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
                className={`flex items-center gap-3 rounded-[14px] border bg-bg px-3 py-2.5 transition-colors hover:bg-sand-chip/50 ${overdue ? "border-danger/30" : "border-transparent hover:border-border"}`}
              >
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${statusStyle.chip}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${statusStyle.dot}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-bold text-text">
                    {item.propertyAddress}
                  </p>
                  <p className="truncate text-[11.5px] text-text-faint">
                    <span className="text-text-faint">{meta.shortLabel}: </span>
                    {formatDate(item.date)} · {SIGNATURE_STATUS_LABEL[status]}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${overdue ? "bg-clay-chip text-terra" : item.daysAway <= 1 ? "bg-sand-chip text-warning" : "bg-surface text-text-faint"}`}
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
