"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { IconClock } from "@/components/icons";
import { m } from "@/lib/messages";

type Choice = "none" | "tonight" | "tomorrow" | "pick";

const CHOICES: Choice[] = ["none", "tonight", "tomorrow", "pick"];
const MIDNIGHT = "00:00";

/* ------------------------------------------------------------- Dates
   Everything here is the sender's local wall-clock time. The form turns the
   result into UTC on submit, exactly as it did with the old datetime-local field. */

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
const addMonths = (date: Date, months: number) => new Date(date.getFullYear(), date.getMonth() + months, 1);
const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const pad = (n: number) => String(n).padStart(2, "0");
const dayKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** The same "YYYY-MM-DDTHH:mm" string a datetime-local input produces. */
const toLocalValue = (date: Date, time: string) => `${dayKey(date)}T${time}`;

/** First day of the week for the viewer's locale: 0 Sunday … 6 Saturday. */
function firstWeekday(): number {
  try {
    const locale = new Intl.Locale(navigator.language) as Intl.Locale & {
      getWeekInfo?: () => { firstDay: number };
      weekInfo?: { firstDay: number };
    };
    const info = locale.getWeekInfo?.() ?? locale.weekInfo;
    if (info) return info.firstDay % 7;
  } catch {
    // Older browsers: fall through.
  }
  return 1;
}

function describe(value: string): string {
  const date = new Date(value);
  const day = new Intl.DateTimeFormat(undefined, { weekday: "long", day: "numeric", month: "long" }).format(date);
  const time = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date);
  return m.create.unlock.summary(day, time);
}

/* ---------------------------------------------------------- Calendar */

function Calendar({ selected, onSelect }: { selected: Date; onSelect: (date: Date) => void }) {
  const labelId = useId();
  const grid = useRef<HTMLDivElement>(null);
  const today = startOfDay(new Date());
  const [view, setView] = useState(() => new Date(selected.getFullYear(), selected.getMonth(), 1));
  const [focused, setFocused] = useState(selected);
  const moveFocus = useRef(false);
  const weekStart = useState(firstWeekday)[0];

  // After a keyboard move, put focus on the newly focused day (which may be in another month).
  useEffect(() => {
    if (!moveFocus.current) return;
    moveFocus.current = false;
    grid.current?.querySelector<HTMLButtonElement>(`[data-day="${dayKey(focused)}"]`)?.focus();
  }, [focused, view]);

  function go(date: Date) {
    const next = date < today ? today : date;
    moveFocus.current = true;
    setFocused(next);
    if (next.getMonth() !== view.getMonth() || next.getFullYear() !== view.getFullYear()) {
      setView(new Date(next.getFullYear(), next.getMonth(), 1));
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const moves: Record<string, () => Date> = {
      ArrowLeft: () => addDays(focused, -1),
      ArrowRight: () => addDays(focused, 1),
      ArrowUp: () => addDays(focused, -7),
      ArrowDown: () => addDays(focused, 7),
      Home: () => addDays(focused, -((focused.getDay() - weekStart + 7) % 7)),
      End: () => addDays(focused, 6 - ((focused.getDay() - weekStart + 7) % 7)),
      PageUp: () => new Date(focused.getFullYear(), focused.getMonth() - 1, focused.getDate()),
      PageDown: () => new Date(focused.getFullYear(), focused.getMonth() + 1, focused.getDate()),
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    go(move());
  }

  const monthLabel = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(view);
  const weekdayFormat = new Intl.DateTimeFormat(undefined, { weekday: "short" });
  const weekdayLong = new Intl.DateTimeFormat(undefined, { weekday: "long" });
  const dayLabel = new Intl.DateTimeFormat(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  // A known Sunday, to name the weekday columns in the viewer's language.
  const columns = Array.from({ length: 7 }, (_, i) => new Date(2026, 0, 4 + ((weekStart + i) % 7)));

  const leading = (view.getDay() - weekStart + 7) % 7;
  const daysInMonth = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(view.getFullYear(), view.getMonth(), i + 1)),
  ];
  while (cells.length % 7) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));

  // The one day that takes Tab focus: the focused day if it's in view, else the first usable day.
  const tabbable =
    focused.getMonth() === view.getMonth() && focused.getFullYear() === view.getFullYear()
      ? focused
      : cells.find((d): d is Date => d !== null && d >= today) ?? null;
  const atFirstMonth = view.getFullYear() === today.getFullYear() && view.getMonth() === today.getMonth();

  return (
    <div role="group" aria-labelledby={labelId} className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          className="ui-button ui-button-quiet size-11 min-h-11 p-0"
          aria-label={m.create.unlock.prevMonth}
          disabled={atFirstMonth}
          onClick={() => setView((v) => addMonths(v, -1))}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.5 6 8.5 12l6 6" />
          </svg>
        </button>
        <p id={labelId} aria-live="polite" className="text-[15px] font-medium">
          {monthLabel}
        </p>
        <button
          type="button"
          className="ui-button ui-button-quiet size-11 min-h-11 p-0"
          aria-label={m.create.unlock.nextMonth}
          onClick={() => setView((v) => addMonths(v, 1))}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="m9.5 6 6 6-6 6" />
          </svg>
        </button>
      </div>

      <div ref={grid} role="grid" aria-labelledby={labelId} className="flex flex-col">
        <div role="row" className="grid grid-cols-7">
          {columns.map((day) => (
            <span key={day.getDay()} role="columnheader" aria-label={weekdayLong.format(day)} className="pb-1 text-center text-[12px] text-fg-muted">
              {weekdayFormat.format(day)}
            </span>
          ))}
        </div>
        {weeks.map((week, w) => (
          <div role="row" key={w} className="grid grid-cols-7">
            {week.map((day, d) => {
              if (!day) return <span role="gridcell" key={`e${d}`} />;
              const isSelected = sameDay(day, selected);
              const isToday = sameDay(day, today);
              const past = day < today;
              return (
                <span role="gridcell" key={dayKey(day)} aria-selected={isSelected} className="grid place-items-center">
                  <button
                    type="button"
                    data-day={dayKey(day)}
                    tabIndex={tabbable && sameDay(day, tabbable) ? 0 : -1}
                    disabled={past}
                    aria-label={dayLabel.format(day)}
                    aria-current={isToday ? "date" : undefined}
                    onKeyDown={onKeyDown}
                    onFocus={() => setFocused(day)}
                    onClick={() => onSelect(day)}
                    className={`relative grid size-11 place-items-center rounded-full text-[15px] tabular-nums transition-[background-color,color,transform] duration-300 ease-spring active:scale-90 disabled:cursor-default disabled:text-fg-muted/45 ${
                      isSelected ? "bg-accent font-medium text-accent-ink" : "text-fg enabled:hover:bg-surface-2"
                    }`}
                  >
                    {day.getDate()}
                    {isToday && !isSelected && (
                      <span aria-hidden="true" className="absolute bottom-1.5 size-1 rounded-full bg-fg-muted" />
                    )}
                  </button>
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ Picker */

/**
 * When the gift opens: quick choices as chips, or a date from the calendar.
 * Reports the same local "YYYY-MM-DDTHH:mm" value the old datetime-local field
 * did ("" for no wait), so the form and the server validation are unchanged.
 */
export function UnlockPicker({
  onChange,
  error,
  errorId,
}: {
  onChange: (value: string) => void;
  error?: string;
  errorId: string;
}) {
  const name = useId();
  const timeId = useId();
  const summaryId = useId();
  const [choice, setChoice] = useState<Choice>("none");
  const [value, setValue] = useState("");
  const [date, setDate] = useState<Date | null>(null);
  const [time, setTime] = useState(MIDNIGHT);

  function emit(next: string) {
    setValue(next);
    onChange(next);
  }

  function choose(next: Choice) {
    setChoice(next);
    const today = startOfDay(new Date());
    if (next === "none") emit("");
    // The midnight that ends today.
    if (next === "tonight") emit(toLocalValue(addDays(today, 1), MIDNIGHT));
    // The midnight that ends tomorrow.
    if (next === "tomorrow") emit(toLocalValue(addDays(today, 2), MIDNIGHT));
    if (next === "pick") {
      const day = date ?? addDays(today, 1);
      setDate(day);
      emit(toLocalValue(day, time));
    }
  }

  const label = {
    none: m.create.unlock.none,
    tonight: m.create.unlock.tonight,
    tomorrow: m.create.unlock.tomorrow,
    pick: m.create.unlock.pick,
  };
  const past = value !== "" && new Date(value).getTime() <= Date.now();
  const describedBy = [summaryId, error ? errorId : null].filter(Boolean).join(" ");

  return (
    <fieldset className="flex flex-col gap-3" aria-describedby={describedBy}>
      <legend className="mb-2 text-[14px] font-medium text-fg">
        {m.create.unlockAt}
        <span className="ms-2 font-normal text-fg-muted">{m.create.optional}</span>
      </legend>

      <div className="flex flex-wrap gap-2">
        {CHOICES.map((option) => (
          <label
            key={option}
            className="inline-flex min-h-11 cursor-pointer select-none items-center rounded-full border border-line bg-canvas px-4 text-[14px] text-fg transition-[border-color,background-color,transform] duration-300 ease-spring hover:border-line-strong active:scale-[0.97] has-checked:border-accent has-checked:bg-surface has-checked:font-medium has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent"
          >
            <input
              type="radio"
              name={name}
              value={option}
              checked={choice === option}
              onChange={() => choose(option)}
              className="sr-only"
            />
            {label[option]}
          </label>
        ))}
      </div>

      {choice === "pick" && date && (
        <div className="arrive ui-card flex flex-col gap-4 p-3 sm:p-4">
          <p className="sr-only">{m.create.unlock.calendar}</p>
          <Calendar
            selected={date}
            onSelect={(day) => {
              setDate(day);
              emit(toLocalValue(day, time));
            }}
          />
          <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
            <label htmlFor={timeId} className="flex items-center gap-2 text-[14px] font-medium">
              <IconClock className="size-4 text-fg-muted" />
              {m.create.unlock.time}
            </label>
            <input
              id={timeId}
              type="time"
              step={60}
              value={time}
              onChange={(event) => {
                const next = event.target.value || MIDNIGHT;
                setTime(next);
                emit(toLocalValue(date, next));
              }}
              className="ui-input w-auto min-w-[8.5rem] text-center tabular-nums"
            />
          </div>
        </div>
      )}

      <div id={summaryId} aria-live="polite" className="flex flex-col gap-1">
        <p className={`text-[14px] ${value ? "font-medium text-fg" : "text-fg-muted"}`}>
          {value ? describe(value) : m.create.unlock.summaryNone}
        </p>
        {value && !past && <p className="text-[13px] text-fg-muted">{m.create.unlock.theirZone}</p>}
        {past && <p className="text-[13px] font-medium text-danger">{m.create.unlock.past}</p>}
      </div>

      {error && (
        <p id={errorId} role="alert" className="text-[13px] font-medium text-danger">
          {error}
        </p>
      )}
    </fieldset>
  );
}
