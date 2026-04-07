import Link from "next/link";
import { SeguimientosPendientesCard } from "./_components/seguimientos-pendientes-card";
import { SeguimientosVencidosCard } from "./_components/seguimientos-vencidos-card";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma/client";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const scopeWhere = user.role === "admin" ? {} : { assignedToUserId: user.id };
  const followUpWhere = {
    ...scopeWhere,
    status: { notIn: ["hecho", "cancelado"] },
  };

  const [pendingFollowUps, overdueFollowUps, propertiesCount, recentFollowUps] = await Promise.all([
    prisma.propertyFollowUp.count({
      where: followUpWhere,
    }),
    prisma.propertyFollowUp.count({
      where: {
        ...followUpWhere,
        dueDate: { lt: new Date() },
      },
    }),
    prisma.property.count(),
    prisma.propertyFollowUp.findMany({
      where: scopeWhere,
      include: {
        property: { select: { address: true } },
        assignedToUser: { select: { fullName: true, email: true } },
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      take: 6,
    }),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="flex flex-col rounded-2xl border border-border bg-surface/40 p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tracking-widest text-text-muted uppercase">
              Propiedades
            </span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
          <p className="mt-3 text-4xl font-light tracking-tight text-text">{propertiesCount}</p>
          <div className="mt-1 border-t border-border pt-2">
            <Link href="/propiedades" className="text-xs text-secondary transition-colors hover:text-secondary/80">
              Ver propiedades
            </Link>
          </div>
        </div>
        <div className="flex flex-col gap-5">
          <SeguimientosPendientesCard count={pendingFollowUps} />
          <SeguimientosVencidosCard count={overdueFollowUps} />
        </div>
        <div className="flex flex-col rounded-2xl border border-border bg-surface/40 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-semibold tracking-widest text-text uppercase">
              Últimos Seguimientos
            </h3>
            <Link href="/seguimientos" className="text-xs text-secondary">
              Ver todo
            </Link>
          </div>
          {recentFollowUps.length === 0 ? (
            <p className="text-sm text-text-muted">Sin seguimientos aún.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {recentFollowUps.map((item) => (
                <div key={item.id} className="rounded-lg border border-border/60 bg-bg/30 px-3 py-2">
                  <p className="truncate text-sm text-text">{item.property.address}</p>
                  <p className="truncate text-xs text-text-muted">
                    {(item.assignedToUser.fullName?.trim() || item.assignedToUser.email)} · {item.status}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
