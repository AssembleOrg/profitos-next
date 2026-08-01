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
      className={`flex flex-col gap-3 rounded-[20px] border border-border bg-surface p-4 transition-opacity ${
        pending ? "opacity-70" : ""
      }`}
    >
      <div className="flex flex-wrap items-end gap-3">
        {showUserFilter && (
          <label className="flex w-full flex-col gap-1.5 sm:w-[200px]">
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-text-faint">
              Empleado
            </span>
            <select
              value={selectedUserId}
              onChange={(e) => update({ assignedToUserId: e.target.value })}
              className="h-11 w-full appearance-none rounded-[14px] border border-border bg-surface px-3.5 text-sm text-text focus:border-border-strong focus:outline-none"
            >
              <option value="">Todos</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName?.trim() || u.email}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-text-faint">
            Desde
          </span>
          <DateField value={from} onChange={(iso) => update({ from: iso })} />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-text-faint">
            Hasta
          </span>
          <DateField value={to} onChange={(iso) => update({ to: iso })} />
        </label>

        <div className="flex flex-wrap items-center gap-1.5 pb-0.5">
          <button
            type="button"
            onClick={setThisMonth}
            className="h-10 rounded-full bg-sand-chip px-3.5 text-[12px] font-semibold text-text-muted transition-opacity hover:opacity-80"
          >
            Este mes
          </button>
          {hasPeriod && (
            <button
              type="button"
              onClick={clearPeriod}
              className="h-10 rounded-full border border-border bg-surface px-3.5 text-[12px] font-semibold text-text-muted transition-colors hover:bg-bg"
            >
              Sin período
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
