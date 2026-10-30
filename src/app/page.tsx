import SubmitButton from "@/components/SubmitButton";
import { requireUser } from "@/lib/auth";
import ReminderSettings from "@/components/ReminderSettings";
import MonthPicker from "@/components/MonthPicker";
import TransactionForm from "@/components/TransactionForm";
import TxTable from "@/components/TxTable";
import { CategoryPie, DailyBars, TrendBars } from "@/components/Charts";
import { refreshRateNow, saveSettings, setOpeningBalance } from "@/lib/actions";
import { normalizeMonth, todayStr } from "@/lib/format";
import { money } from "@/lib/currency";
import { refreshRateInBackground } from "@/lib/rate";
import { getReminder, getSettings } from "@/lib/settings";
import { getCategories, getLoansByPerson, getMonthSummary, getSpendByCurrency, getTransactions, getTrend } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const month = normalizeMonth((await searchParams).m);
  const uid = (await requireUser()).id;
  refreshRateInBackground();
  const reminder = getReminder(uid);
  const cur = getSettings(uid).display;
  const settings = getSettings(uid);
  const m = (n: number) => money(n, cur);
  const s = getMonthSummary(uid, month);
  const byCur = getSpendByCurrency(uid, month);
  const recent = getTransactions(uid, { month, limit: 8 });
  const categories = getCategories(uid);
  const trend = getTrend(uid, month);
  const totalOut = s.breakdown.reduce((a, b) => a + b.value, 0) || 1;
  const loanPeople = getLoansByPerson(uid);
  const owedToMe = loanPeople.filter((p) => p.net > 0).reduce((a, p) => a + p.net, 0);
  const iOwe = loanPeople.filter((p) => p.net < 0).reduce((a, p) => a - p.net, 0);

  return (
    <>
      <div className="page-head">
        <h1>Dashboard</h1>
        <MonthPicker month={month} base="/" />
      </div>

      <form action={saveSettings} className="card inline-form">
        <label style={{ maxWidth: 200 }}>
          Show totals in
          <select name="display" defaultValue={settings.display}>
            <option value="KES">KSh (Kenyan Shilling)</option>
            <option value="USD">$ (US Dollar)</option>
          </select>
        </label>
        <SubmitButton pendingText="Saving…">Save</SubmitButton>
        <span className="muted" style={{ fontSize: "0.85rem" }}>
          1 USD = <strong>{settings.rate.toFixed(2)} KSh</strong>
          {settings.updatedAt
            ? ` · live rate, updated ${new Date(settings.updatedAt).toLocaleString("en-GB")}`
            : " · estimate (could not fetch live rate)"}
        </span>
      </form>

      <div className="card stat">
        <div className="label">Loans (all time, after repayments)</div>
        <div className="value">{m(owedToMe)} <span className="muted" style={{ fontSize: "0.9rem" }}>owed to me</span></div>
        <div className="sub">
          {iOwe > 0 ? `I owe ${m(iOwe)} · ` : ""}
          <a href="/loans" style={{ textDecoration: "underline" }}>See who owes what</a>
        </div>
      </div>

      <ReminderSettings enabled={reminder.enabled} time={reminder.time} />

      <form action={refreshRateNow} style={{ marginTop: -12 }}>
        <SubmitButton className="btn ghost" style={{ fontSize: "0.8rem" }} pendingText="Refreshing…">↻ Refresh exchange rate now</SubmitButton>
      </form>

      <div className="grid cols-4">
        <div className="card stat">
          <div className="label">Opening balance</div>
          <div className="value">{m(s.opening)}</div>
          <div className="sub">
            {money(s.perCurrency.KES.opening, "KES")} · {money(s.perCurrency.USD.opening, "USD")}
          </div>
        </div>
        <div className="card stat">
          <div className="label">Total spent</div>
          <div className="value neg">{m(s.spent)}</div>
          <div className="sub">
            Expenses {m(s.totals.expense)}
            {s.totals.repay_out > 0 && ` · Debts repaid ${m(s.totals.repay_out)}`}
          </div>
        </div>
        <div className="card stat">
          <div className="label">Left (end of month)</div>
          <div className={`value ${s.closing < 0 ? "neg" : ""}`}>{m(s.closing)}</div>
          <div className="sub">
            {money(s.perCurrency.KES.closing, "KES")} · {money(s.perCurrency.USD.closing, "USD")}
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Spent by currency</h2>
        <div className="grid cols-4">
          {byCur.map((c) => (
            <div key={c.currency} className="stat">
              <div className="label">{c.currency === "KES" ? "Kenyan Shilling" : "US Dollar"}</div>
              <div className="value neg">{money(c.total, c.currency)}</div>
              <div className="sub">
                Expenses {money(c.expense, c.currency)}
                {c.loans > 0 && ` · Debts repaid ${money(c.loans, c.currency)}`}
              </div>
            </div>
          ))}
          <div className="stat">
            <div className="label">Combined in {cur === "KES" ? "KSh" : "USD"}</div>
            <div className="value neg">{m(s.spent)}</div>
            <div className="sub">At 1 USD = {settings.rate.toFixed(2)} KSh</div>
          </div>
        </div>
      </div>

      <form action={setOpeningBalance} className="card inline-form">
        <input type="hidden" name="month" value={month} />
        {(["KES", "USD"] as const).map((c) => (
          <label key={c}>
            Money I had at the start ({c === "KES" ? "KSh" : "USD"})
            <input
              name={`opening_${c}`}
              type="number"
              step="0.01"
              defaultValue={s.perCurrency[c].explicit ? s.perCurrency[c].opening : ""}
              placeholder={`Auto: ${s.perCurrency[c].opening.toFixed(2)}`}
            />
          </label>
        ))}
        <SubmitButton pendingText="Saving…">Save opening balance</SubmitButton>
        <span className="muted" style={{ fontSize: "0.8rem" }}>
          Leave a box empty to carry it over from last month. Left = opening + received − spent − lent.
        </span>
      </form>

      <div className="grid cols-2">
        <div className="card">
          <h2>Where my money went</h2>
          <CategoryPie data={s.breakdown} cur={cur} />
          {s.breakdown.map((b) => (
            <div key={b.name} className="legend-row">
              <span className="dot" style={{ background: b.color }} />
              <div className="grow">
                {b.emoji} {b.name}
                <div className="bar-track">
                  <div
                    className="bar-fill"
                    style={{ width: `${(b.value / totalOut) * 100}%`, background: b.color }}
                  />
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <strong>{m(b.value)}</strong>
                <div className="muted" style={{ fontSize: "0.75rem" }}>
                  {((b.value / totalOut) * 100).toFixed(1)}%
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="card">
          <h2>Month summary</h2>
          <div className="summary-line"><span>Opening balance</span><span>{m(s.opening)}</span></div>
          {s.moneyIn > 0 && (
            <div className="summary-line"><span>+ Money received (incl. loans repaid to me)</span><span className="pos">{m(s.moneyIn)}</span></div>
          )}
          <div className="summary-line"><span>− Expenses</span><span className="neg">{m(s.totals.expense)}</span></div>
          <div className="summary-line"><span>− Lent to others (until repaid)</span><span className="neg">{m(s.totals.lent)}</span></div>
          <div className="summary-line"><span>− Loans I repaid</span><span className="neg">{m(s.totals.repay_out)}</span></div>
          <div className="summary-line"><span>= Left</span><span>{m(s.closing)}</span></div>
        </div>
      </div>

      <div className="grid cols-2">
        <div className="card">
          <h2>Daily spending</h2>
          <DailyBars data={s.daily} cur={cur} />
        </div>
        <div className="card">
          <h2>Spending, last 6 months</h2>
          <TrendBars data={trend} cur={cur} />
        </div>
      </div>

      <TransactionForm categories={categories} today={todayStr()} defaultCurrency={cur} loanPeople={loanPeople.map((p) => p.person)} />

      <div className="card">
        <h2>Recent transactions</h2>
        <TxTable rows={recent} display={cur} />
      </div>
    </>
  );
}
