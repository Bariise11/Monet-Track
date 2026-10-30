import Link from "next/link";
import MonthPicker from "@/components/MonthPicker";
import PrintButton from "@/components/PrintButton";
import { CategoryPie, DailyBars } from "@/components/Charts";
import { requireUser } from "@/lib/auth";
import { money } from "@/lib/currency";
import { monthLabel, normalizeMonth, shiftMonth } from "@/lib/format";
import { refreshRateInBackground } from "@/lib/rate";
import {
  getLoansByPerson,
  getMonthSummary,
  getSpendByCurrency,
  getTransactions,
} from "@/lib/queries";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

function Delta({ now, before }: { now: number; before: number | undefined }) {
  if (!before) return <span className="muted">{now > 0 ? "new" : "–"}</span>;
  const pct = ((now - before) / before) * 100;
  if (Math.abs(pct) < 0.05) return <span className="muted">0%</span>;
  // for spending, an increase is "bad" (red)
  return (
    <span className={pct > 0 ? "neg" : "pos"}>
      {pct > 0 ? "▲" : "▼"} {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

export default async function Report({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const user = await requireUser();
  const uid = user.id;
  refreshRateInBackground();
  const month = normalizeMonth((await searchParams).m);
  const prevMonth = shiftMonth(month, -1);
  const settings = getSettings(uid);
  const cur = settings.display;
  const m = (n: number) => money(n, cur);

  const s = getMonthSummary(uid, month);
  const prev = getMonthSummary(uid, prevMonth);
  const byCur = getSpendByCurrency(uid, month);
  const expenses = getTransactions(uid, { month, type: "expense" });
  const top = [...expenses].sort((a, b) => b.converted - a.converted).slice(0, 10);
  const loans = getLoansByPerson(uid).filter((p) => p.net !== 0);
  const owedToMe = loans.filter((p) => p.net > 0).reduce((a, p) => a + p.net, 0);
  const iOwe = loans.filter((p) => p.net < 0).reduce((a, p) => a - p.net, 0);
  const prevByName = new Map(prev.breakdown.map((b) => [b.name, b.value]));
  const totalOut = s.breakdown.reduce((a, b) => a + b.value, 0);
  const days = s.daily.filter((d) => d.out > 0).length;
  const avgPerDay = s.spent / (s.daily.length || 1);
  const biggest = s.breakdown[0];

  return (
    <>
      <div className="page-head no-print">
        <h1>Monthly report</h1>
        <div className="head-actions">
          <MonthPicker month={month} base="/report" />
          <a className="btn" href={`/api/export?m=${month}`}>
            Download CSV
          </a>
          <PrintButton />
        </div>
      </div>

      <div className="card report-head">
        <div>
          <div className="report-title">Money Track — Spending report</div>
          <div className="report-month">{monthLabel(month)}</div>
        </div>
        <div className="muted report-meta">
          Prepared for <strong>{user.name}</strong>
          <br />
          Generated {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
          <br />
          All totals in {cur === "KES" ? "KSh" : "USD"} · 1 USD = {settings.rate.toFixed(2)} KSh
        </div>
      </div>

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
            vs {monthLabel(prevMonth)} ({m(prev.spent)}) <Delta now={s.spent} before={prev.spent} />
          </div>
        </div>
        <div className="card stat">
          <div className="label">Money received</div>
          <div className="value pos">{m(s.moneyIn)}</div>
          <div className="sub">Income, loans taken, repayments to me</div>
        </div>
        <div className="card stat">
          <div className="label">Left at end of month</div>
          <div className={`value ${s.closing < 0 ? "neg" : ""}`}>{m(s.closing)}</div>
          <div className="sub">
            {money(s.perCurrency.KES.closing, "KES")} · {money(s.perCurrency.USD.closing, "USD")}
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Highlights</h2>
        <ul className="highlights">
          <li>
            You spent <strong>{m(s.spent)}</strong> across <strong>{expenses.length}</strong> expense
            {expenses.length === 1 ? "" : "s"} on <strong>{days}</strong> day{days === 1 ? "" : "s"}.
          </li>
          <li>
            Average spending per day: <strong>{m(avgPerDay)}</strong>.
          </li>
          {biggest && (
            <li>
              Biggest category: <strong>{biggest.emoji} {biggest.name}</strong> — {m(biggest.value)} (
              {((biggest.value / (totalOut || 1)) * 100).toFixed(1)}% of spending).
            </li>
          )}
          {s.totals.lent > 0 && (
            <li>
              You lent out <strong>{m(s.totals.lent)}</strong> this month (not counted as spending).
            </li>
          )}
          {prev.spent > 0 && (
            <li>
              Spending is {s.spent >= prev.spent ? "up" : "down"}{" "}
              <strong>{m(Math.abs(s.spent - prev.spent))}</strong> compared to {monthLabel(prevMonth)}.
            </li>
          )}
        </ul>
      </div>

      <div className="grid cols-2">
        <div className="card">
          <h2>Spending by category</h2>
          <CategoryPie data={s.breakdown} cur={cur} />
        </div>
        <div className="card">
          <h2>Daily spending</h2>
          <DailyBars data={s.daily} cur={cur} />
        </div>
      </div>

      <div className="card">
        <h2>Category breakdown</h2>
        {s.breakdown.length === 0 ? (
          <p className="muted">No spending recorded this month.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Category</th>
                  <th className="num">Amount</th>
                  <th className="num">Share</th>
                  <th className="num">Last month</th>
                  <th className="num">Change</th>
                </tr>
              </thead>
              <tbody>
                {s.breakdown.map((b) => (
                  <tr key={b.name}>
                    <td>
                      <span className="dot" style={{ background: b.color, display: "inline-block", marginRight: 8 }} />
                      {b.emoji} {b.name}
                    </td>
                    <td className="num">{m(b.value)}</td>
                    <td className="num">{((b.value / (totalOut || 1)) * 100).toFixed(1)}%</td>
                    <td className="num">{prevByName.has(b.name) ? m(prevByName.get(b.name)!) : "–"}</td>
                    <td className="num">
                      <Delta now={b.value} before={prevByName.get(b.name)} />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>
                    <strong>Total</strong>
                  </td>
                  <td className="num">
                    <strong>{m(totalOut)}</strong>
                  </td>
                  <td className="num">100%</td>
                  <td className="num">{m(prev.spent)}</td>
                  <td className="num">
                    <Delta now={s.spent} before={prev.spent} />
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      <div className="grid cols-2">
        <div className="card">
          <h2>By currency (original amounts)</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Currency</th>
                  <th className="num">Expenses</th>
                  <th className="num">Debts repaid</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {byCur.map((c) => (
                  <tr key={c.currency}>
                    <td>{c.currency === "KES" ? "Kenyan Shilling" : "US Dollar"}</td>
                    <td className="num">{money(c.expense, c.currency)}</td>
                    <td className="num">{money(c.loans, c.currency)}</td>
                    <td className="num">
                      <strong>{money(c.total, c.currency)}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h2>Cash flow</h2>
          <div className="summary-line"><span>Opening balance</span><span>{m(s.opening)}</span></div>
          {s.moneyIn > 0 && (
            <div className="summary-line"><span>+ Money received</span><span className="pos">{m(s.moneyIn)}</span></div>
          )}
          <div className="summary-line"><span>− Expenses</span><span className="neg">{m(s.totals.expense)}</span></div>
          {s.totals.lent > 0 && (
            <div className="summary-line"><span>− Lent to others</span><span className="neg">{m(s.totals.lent)}</span></div>
          )}
          {s.totals.repay_out > 0 && (
            <div className="summary-line"><span>− Debts I repaid</span><span className="neg">{m(s.totals.repay_out)}</span></div>
          )}
          <div className="summary-line"><span>= Left at end of month</span><span>{m(s.closing)}</span></div>
        </div>
      </div>

      <div className="card">
        <h2>Top 10 expenses</h2>
        {top.length === 0 ? (
          <p className="muted">No expenses this month.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Date</th>
                  <th>Category</th>
                  <th>Details</th>
                  <th className="num">Amount</th>
                  <th className="num">In {cur === "KES" ? "KSh" : "USD"}</th>
                </tr>
              </thead>
              <tbody>
                {top.map((t, i) => (
                  <tr key={t.id}>
                    <td>{i + 1}</td>
                    <td>{t.date}</td>
                    <td>
                      {t.category_emoji} {t.category_name}
                    </td>
                    <td style={{ whiteSpace: "normal" }}>
                      {t.person && <strong>{t.person}</strong>}
                      {t.person && t.note ? " · " : ""}
                      {t.note}
                    </td>
                    <td className="num">{money(t.amount, t.currency)}</td>
                    <td className="num">{m(t.converted)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <h2>Loans outstanding (all time)</h2>
        {loans.length === 0 ? (
          <p className="muted">No unpaid loans. 🎉</p>
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Person</th>
                    <th className="num">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loans.map((p) => (
                    <tr key={p.person}>
                      <td>
                        <strong>{p.person}</strong>
                      </td>
                      <td className={`num ${p.net > 0 ? "pos" : "neg"}`}>
                        {p.net > 0 ? `owes me ${m(p.net)}` : `I owe ${m(-p.net)}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="muted" style={{ marginBottom: 0 }}>
              Owed to me <strong className="pos">{m(owedToMe)}</strong> · I owe{" "}
              <strong className="neg">{m(iOwe)}</strong> ·{" "}
              <Link href="/loans" className="no-print" style={{ textDecoration: "underline" }}>
                Manage loans
              </Link>
            </p>
          </>
        )}
      </div>

      <p className="muted report-foot">
        Generated by Money Track. Amounts in other currencies are converted at the rate shown above.
      </p>
    </>
  );
}
