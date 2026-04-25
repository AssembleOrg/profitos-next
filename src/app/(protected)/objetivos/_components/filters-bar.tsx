"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { defaultPeriod } from "@/lib/objectives";
import { DateField } from "../../_components/date-field";
import type { SerializedUser } from "./types";

interface FiltersBarProps {
  users: SerializedUser[];
  showUserFilter: boolean;
  selectedUserId: string;
  from: string;
  to: string;
}

export function FiltersBar({
  users,
  showUserFilter,
  selectedUserId,
  from,
  to,
}: Readonly<FiltersBarProps>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function update(patch: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === "") params.delete(key);
      else params.set(key, value);
    }
    params.delete("page");
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname);
    });
  }

  function setThisMonth() {
    const period = defaultPeriod();
    update({ from: period.startDate, to: period.endDate });
  }

  function clearPeriod() {
    update({ from: null, to: null });
  }

  const hasPeriod = Boolean(from || to);

  return (
    <div
      className={`flex flex-col gap-3 rounded-2xl border border-border bg-surface/40 p-3 transition-opacity sm:flex-row sm:items-end ${
        pending ? "opacity-70" : ""
      }`}
    >
      {showUserFilter && (
        <label className="flex flex-col gap-1.5 sm:min-w-[220px]">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
            Empleado
          </span>
          <select
            value={selectedUserId}
            onChange={(e) => update({ assignedToUserId: e.target.value })}
            className="h-10 rounded-xl border border-border bg-bg px-3 text-sm text-text focus:border-secondary focus:outline-none scheme-dark"
          >
            <option value="">Todos los empleados</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.fullName?.trim() || u.email}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="flex flex-col gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
          Desde
        </span>
        <DateField value={from} onChange={(iso) => update({ from: iso })} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
          Hasta
        </span>
        <DateField value={to} onChange={(iso) => update({ to: iso })} />
      </label>

      <div className="flex flex-wrap items-center gap-1.5 sm:ml-auto">
        <button
          type="button"
          onClick={setThisMonth}
          className="h-10 rounded-xl border border-border bg-bg px-3 text-xs font-medium text-text-muted transition-colors hover:border-olive-bright/40 hover:text-text"
        >
          Este mes
        </button>
        {hasPeriod && (
          <button
            type="button"
            onClick={clearPeriod}
            className="h-10 rounded-xl border border-border bg-bg px-3 text-xs font-medium text-text-muted transition-colors hover:border-olive-bright/40 hover:text-text"
          >
            Histórico (sin período)
          </button>
        )}
      </div>
    </div>
  );
}
