import Link from "next/link";
import { monthLabel, shiftMonth } from "@/lib/format";

export default function MonthPicker({ month, base }: { month: string; base: string }) {
  return (
    <div className="month-picker">
      <Link href={`${base}?m=${shiftMonth(month, -1)}`} className="btn ghost">
        ←
      </Link>
      <strong>{monthLabel(month)}</strong>
      <Link href={`${base}?m=${shiftMonth(month, 1)}`} className="btn ghost">
        →
      </Link>
    </div>
  );
}
