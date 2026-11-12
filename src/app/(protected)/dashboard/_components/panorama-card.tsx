import Link from "next/link";
import { prisma } from "@/lib/prisma/client";
import { formatDate, now } from "@/lib/datetime";
import { getCurrentAccess } from "@/lib/auth/access";
import { formatMoney, type Currency } from "@/lib/account";
import { getCashOverview, type Money } from "@/lib/account/cash-server";

const CURRENCIES: Currency[] = ["ARS", "USD"];
const RENEWAL_DAYS = 60;

function moneyText(value: Money, fallback = "$ 0"): string {
  const parts = CURRENCIES.filter((c) => value[c] !== 0).map((c) => formatMoney(value[c], c));
  // " · " y no " + ": pesos y dólares no se suman (ver DESIGN.md, Patrón de vista).
  return parts.length > 0 ? parts.join(" · ") : fallback;
}

/**
 * Inicio: lo que hay que tener a la vista de un vistazo.
 * Plata (caja, a cobrar, a pagar), reservas en curso y renovaciones próximas.
 * Cada bloque se muestra solo si el usuario tiene acceso a esa sección.
 */
export async function PanoramaCard() {
  const access = await getCurrentAccess();
  if (!access) return null;
  const can = (href: string) => access.accessibleHrefs.includes(href);
  const showMoney = can("/estados-cuenta");
  const showSignatures = can("/firmas");
  const showRentals = can("/alquileres");
  if (!showMoney && !showSignatures && !showRentals) return null;

  const today = now().startOf("day");
  const renewalLimit = today.plus({ days: RENEWAL_DAYS });

  const [cash, proposals, endings] = await Promise.all([
    showMoney ? getCashOverview({ isAdmin: access.isAdmin }) : Promise.resolve(null),
    showSignatures
      ? prisma.signatureProposal.findMany({
          where: { status: { notIn: ["propuesta_rechazada", "entrega_llaves"] } },
          select: { property: { select: { operationType: true } } },
        })
      : Promise.resolve([]),
    showRentals
      ? prisma.rentalContract.findMany({
          where: { endDate: { gte: today.toJSDate(), lte: renewalLimit.toJSDate() } },
          orderBy: { endDate: "asc" },
          select: {
            id: true,
            endDate: true,
            unit: true,
            property: { select: { address: true } },
            tenant: { select: { fullName: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  const rentReservations = proposals.filter((p) => /alquiler/i.test(p.property.operationType ?? "")).length;
  const saleReservations = proposals.length - rentReservations;
  const caja = cash?.funds.find((f) => f.key === "caja")?.balance ?? null;
  const people = cash?.funds.filter((f) => f.fund === "persona") ?? [];
  const banco = cash?.funds.find((f) => f.key === "banco") ?? null;

  return (
    <section className="flex flex-col gap-4 rounded-[20px] border border-border bg-surface p-3.5 md:p-5">
      <header className="flex items-center justify-between gap-2">
        <h3 className="font-display text-base font-semibold text-text">Panorama</h3>
        {showMoney && (
          <Link href="/estados-cuenta/caja" className="text-[12.5px] font-semibold text-text-muted hover:text-text">
            Ver caja y pendientes →
          </Link>
        )}
      </header>

      {cash && caja && (
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <Tile label="En la caja" href="/estados-cuenta/caja" dark>
            <span className="truncate font-display text-base font-bold tabular-nums md:text-lg" title={formatMoney(caja.ARS, "ARS")}>{formatMoney(caja.ARS, "ARS")}</span>
            {caja.USD !== 0 && <span className="truncate font-display text-sm font-bold tabular-nums" title={formatMoney(caja.USD, "USD")}>{formatMoney(caja.USD, "USD")}</span>}
            {(cash.ownerPendingInCaja.ARS !== 0 || cash.ownerPendingInCaja.USD !== 0) && (
              <span className="text-[11px] text-dark-fg/70">De propietarios: {moneyText(cash.ownerPendingInCaja)}</span>
            )}
          </Tile>
          <Tile label="A cobrar" href="/estados-cuenta/caja">
            <span className="font-display text-base font-bold tabular-nums text-warning [overflow-wrap:anywhere]">{moneyText(cash.receivableTotal)}</span>
            {(cash.receivableOverdue.ARS !== 0 || cash.receivableOverdue.USD !== 0) && (
              <span className="text-[11px] font-semibold text-terra">Vencido {moneyText(cash.receivableOverdue)}</span>
            )}
          </Tile>
          <Tile label="A pagar" href="/estados-cuenta/caja">
            <span className="font-display text-base font-bold tabular-nums text-terra [overflow-wrap:anywhere]">{moneyText(cash.payableTotal)}</span>
          </Tile>
          <Tile label="Propietarios sin retirar" href="/estados-cuenta/caja">
            <span className="font-display text-base font-bold tabular-nums text-text [overflow-wrap:anywhere]">{moneyText(cash.ownerPendingTotal)}</span>
          </Tile>
        </div>
      )}

      {cash && access.isAdmin && (people.length > 0 || banco) && (
        <div className="flex flex-wrap gap-2">
          {banco && (
            <span className="rounded-full bg-bg px-3 py-1.5 text-[12px] text-text-muted">
              Banco <span className="font-display font-bold text-text">{moneyText(banco.balance)}</span>
            </span>
          )}
          {people.map((p) => (
            <span key={p.key} className="rounded-full bg-bg px-3 py-1.5 text-[12px] text-text-muted">
              Tiene {p.label} <span className="font-display font-bold text-text">{moneyText(p.balance)}</span>
            </span>
          ))}
        </div>
      )}

      {(showSignatures || showRentals) && (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {showSignatures && (
            <Link href="/firmas" className="rounded-[14px] bg-bg px-3.5 py-3 transition-colors hover:bg-sand-chip/50">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-text-faint">Reservas en curso</p>
              <p className="mt-1 flex items-baseline gap-4">
                <span>
                  <span className="font-display text-xl font-bold text-text">{saleReservations}</span>
                  <span className="ml-1 text-[12px] text-text-muted">venta</span>
                </span>
                <span>
                  <span className="font-display text-xl font-bold text-text">{rentReservations}</span>
                  <span className="ml-1 text-[12px] text-text-muted">alquiler</span>
                </span>
              </p>
            </Link>
          )}
          {showRentals && (
            <div className="rounded-[14px] bg-bg px-3.5 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-text-faint">
                Renovaciones próximas · {RENEWAL_DAYS} días
              </p>
              {endings.length === 0 ? (
                <p className="mt-1 text-[12.5px] text-text-faint">No vence ningún contrato.</p>
              ) : (
                <ul className="mt-1 flex flex-col gap-1">
                  {endings.slice(0, 4).map((c) => (
                    <li key={c.id}>
                      <Link href={`/alquileres/${c.id}`} className="flex items-center justify-between gap-2 text-[12.5px] hover:underline">
                        <span className="truncate font-semibold text-text">
                          {[c.property.address, c.unit].filter(Boolean).join(" ")}
                          <span className="font-normal text-text-faint"> · {c.tenant.fullName}</span>
                        </span>
                        <span className="shrink-0 text-text-muted">{formatDate(c.endDate)}</span>
                      </Link>
                    </li>
                  ))}
                  {endings.length > 4 && (
                    <li>
                      <Link href="/agenda" className="text-[12px] font-semibold text-text-muted hover:text-text">
                        y {endings.length - 4} más en la agenda →
                      </Link>
                    </li>
                  )}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function Tile({
  label,
  href,
  dark = false,
  children,
}: Readonly<{ label: string; href: string; dark?: boolean; children: React.ReactNode }>) {
  return (
    <Link
      href={href}
      className={`flex min-w-0 flex-col gap-0.5 rounded-[14px] px-3 py-3 transition-opacity md:px-3.5 hover:opacity-90 ${
        dark ? "bg-dark text-dark-fg" : "bg-bg"
      }`}
    >
      <span className={`text-[10px] font-bold uppercase tracking-[0.12em] ${dark ? "text-accent" : "text-text-faint"}`}>{label}</span>
      {children}
    </Link>
  );
}
