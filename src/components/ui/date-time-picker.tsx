"use client";

import { useState } from "react";
import { DateTime } from "@/lib/datetime";
import { DatePicker } from "./date-picker";
import { TimePicker } from "./time-picker";

interface DateTimePickerProps {
  /** name del input hidden; el valor combinado es "YYYY-MM-DDTHH:mm" (como datetime-local). */
  name?: string;
  /** Valor controlado "YYYY-MM-DDTHH:mm". */
  value?: string;
  /** Valor inicial "YYYY-MM-DDTHH:mm" para uso no controlado. */
  defaultValue?: string;
  onChange?: (value: string) => void;
  required?: boolean;
}

function splitValue(v: string | undefined): { date: string; time: string } {
  if (!v) return { date: "", time: "" };
  const [d, t] = v.split("T");
  return { date: (d ?? "").slice(0, 10), time: (t ?? "").slice(0, 5) };
}

export function DateTimePicker({ name, value, defaultValue, onChange, required }: Readonly<DateTimePickerProps>) {
  const isControlled = value !== undefined;
  const initial = splitValue(isControlled ? value : defaultValue);
  const [date, setDate] = useState(initial.date);
  // Hora por defecto: la actual, para acciones "ahora".
  const [time, setTime] = useState(initial.time || DateTime.now().toFormat("HH:mm"));

  const d = isControlled ? splitValue(value).date : date;
  const t = (isControlled ? splitValue(value).time : time) || DateTime.now().toFormat("HH:mm");

  const combined = d ? `${d}T${t}` : "";

  function emit(nextDate: string, nextTime: string) {
    onChange?.(nextDate ? `${nextDate}T${nextTime}` : "");
  }

  return (
    <div className="flex items-start gap-2">
      {name && <input type="hidden" name={name} value={combined} required={required} />}
      <div className="flex-1">
        <DatePicker
          value={d}
          onChange={(iso) => {
            setDate(iso);
            emit(iso, t);
          }}
        />
      </div>
      <div className="w-24 shrink-0">
        <TimePicker
          value={t}
          onChange={(hm) => {
            setTime(hm);
            emit(d, hm);
          }}
        />
      </div>
    </div>
  );
}
