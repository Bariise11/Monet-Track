import { requireUser } from "@/lib/auth";
import MonthPicker from "@/components/MonthPicker";
import TxTable from "@/components/TxTable";
import { normalizeMonth } from "@/lib/format";
import { money } from "@/lib/currency";
import { refreshRateInBackground } from "@/lib/rate";
import { getSettings } from "@/lib/settings";
import { getCategories, getTransactions } from "@/lib/queries";
import { TX_TYPES, isInflow } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Transactions({
  searchParams,
}: {
  searchParams: Promise<{ m?: string; all?: string; from?: string; to?: string; type?: string; cat?: string; q?: string }>;
}) {
  const uid = (await requireUser()).id;
  const sp = await searchParams;
  refreshRateInBackground();
  const cur = getSettings(uid).display;
  const m = (n: number) => money(n, cur);
  const range = Boolean(sp.from || sp.to);
  const all = sp.all === "1" && !range;
  const month = normalizeMonth(sp.m);
  const rows = getTransactions(uid, {
    month: all || range ? undefined : month,
    from: sp.from || undefined,
    to: sp.to || undefined,
    type: sp.type || undefined,
    categoryId: Number(sp.cat) || undefined,
    q: sp.q || undefined,
  });
  const categories = getCategories(uid);
  const inTotal = rows.filter((r) => isInflow(r.type)).reduce((a, r) => a + r.converted, 0);
  const outTotal = rows.filter((r) => !isInflow(r.type)).reduce((a, r) => a + r.converted, 0);
  const exportQs = new URLSearchParams(
    Object.entries({ ...(all || range ? {} : { m: month }), from: sp.from, to: sp.to, type: sp.type, cat: sp.cat, q: sp.q }).filter(
      ([, v]) => v,
    ) as [string, string][],
  ).toString();

  return (
    <>
      <div className="page-head">
        <h1>Transactions</h1>
        {!all && !range && <MonthPicker month={month} base="/transactions" />}
      </div>

      <form className="card filters" method="get">
        {!all && !range && <input type="hidden" name="m" value={month} />}
        <label>
          Range
          <select name="all" defaultValue={all ? "1" : ""}>
            <option value="">This month</option>
            <option value="1">All time</option>
          </select>
        </label>
        <label>
          From date
          <input type="date" name="from" defaultValue={sp.from ?? ""} />
        </label>
        <label>
          To date
          <input type="date" name="to" defaultValue={sp.to ?? ""} />
        </label>
        <label>
          Type
          <select name="type" defaultValue={sp.type ?? ""}>
            <option value="">All</option>
            {TX_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </label>
        <label>
          Category
          <select name="cat" defaultValue={sp.cat ?? ""}>
            <option value="">All</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>
            ))}
          </select>
        </label>
        <label>
          Search
          <input name="q" defaultValue={sp.q ?? ""} placeholder="Note or person" />
        </label>
        <button className="btn primary">Filter</button>
        <a className="btn" href={`/api/export${exportQs ? "?" + exportQs : ""}`}>Export CSV</a>
      </form>

      <div className="card">
        <p className="muted" style={{ marginTop: 0 }}>
          {rows.length} transactions · In <span className="pos">{m(inTotal)}</span> · Out{" "}
          <span className="neg">{m(outTotal)}</span>
        </p>
        <TxTable rows={rows} display={cur} />
      </div>
    </>
  );
}
