export type DayMark =
  | "none"
  | "open"
  | "present"
  | "leave"
  | "not_attending"
  | "absent";

export type DayClassifyInput = {
  hasSession: boolean;
  isFuture: boolean;
  isToday: boolean;
  hasPresent: boolean;
  hasLeave: boolean;
  hasNotAttending: boolean;
};

/** Attendance mark for a calendar cell. Leave wins over presence; today stays open until marked. */
export function classifyDay(input: DayClassifyInput): DayMark {
  if (!input.hasSession) return "none";
  if (input.hasLeave) return "leave";
  if (input.hasNotAttending) return "not_attending";
  if (input.hasPresent) return "present";
  if (input.isFuture) return "none";
  if (input.isToday) return "open";
  return "absent";
}

export function dayMarkLabel(mark: DayMark): string {
  switch (mark) {
    case "present":
      return "Present";
    case "leave":
      return "Leave";
    case "not_attending":
      return "Not attending";
    case "absent":
      return "Absent";
    case "open":
      return "Open";
    default:
      return "No Sabha";
  }
}

export function monthGrid(year: number, month: number): Array<{ date: string; inMonth: boolean }> {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const startWeekday = first.getUTCDay(); // 0 Sun
  // Monday-first grid used by most HR calendars.
  const mondayOffset = (startWeekday + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: Array<{ date: string; inMonth: boolean }> = [];
  for (let i = 0; i < mondayOffset; i += 1) {
    const d = new Date(Date.UTC(year, month - 1, 1 - (mondayOffset - i)));
    cells.push({ date: d.toISOString().slice(0, 10), inMonth: false });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const mm = String(month).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    cells.push({ date: `${year}-${mm}-${dd}`, inMonth: true });
  }
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1]!.date;
    const [y, m, d] = last.split("-").map(Number);
    const next = new Date(Date.UTC(y, m - 1, d + 1));
    cells.push({ date: next.toISOString().slice(0, 10), inMonth: false });
  }
  return cells;
}

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}
