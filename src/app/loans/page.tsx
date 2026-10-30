import { requireUser } from "@/lib/auth";
import { addTransaction } from "@/lib/actions";
import { todayStr } from "@/lib/format";
import SubmitButton from "@/components/SubmitButton";
import TxTable from "@/components/TxTable";
import { money } from "@/lib/currency";
import { refreshRateInBackground } from "@/lib/rate";
import { getSettings } from "@/lib/settings";
import { getLoansByPerson, getTransactions } from "@/lib/queries";
import { LOAN_TYPES } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Loans() {
  const uid = (await requireUser()).id;
  refreshRateInBackground();
  const cur = getSettings(uid).display;
  const m = (n: number) => money(n, cur);
  const people = getLoansByPerson(uid);
  const owedToMe = people.filter((p) => p.net > 0).reduce((a, p) => a + p.net, 0);
  const iOwe = people.filter((p) => p.net < 0).reduce((a, p) => a - p.net, 0);
  const history = getTransactions(uid).filter((t) => LOAN_TYPES.includes(t.type));

  return (
    <>
      <h1>Loans</h1>
      <p className="muted" style={{ margin: 0 }}>
        Record loans from the Dashboard (Loan given, Loan taken, repayments). Balances are per person.
      </p>

      <div className="grid cols-4">
        <div className="card stat">
          <div className="label">People owe me</div>
          <div className="value pos">{m(owedToMe)}</div>
        </div>
        <div className="card stat">
          <div className="label">I owe</div>
          <div className="value neg">{m(iOwe)}</div>
        </div>
        <div className="card stat">
          <div className="label">Net position</div>
          <div className={`value ${owedToMe - iOwe < 0 ? "neg" : "pos"}`}>{m(owedToMe - iOwe)}</div>
        </div>
      </div>

      <div className="card">
        <h2>By person</h2>
        {people.length === 0 ? (
          <p className="muted">No loans recorded yet.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Person</th>
                  <th className="num">I lent</th>
                  <th className="num">Paid back to me</th>
                  <th className="num">I borrowed</th>
                  <th className="num">I paid back</th>
                  <th className="num">Status</th>
                  <th>Record repayment</th>
                </tr>
              </thead>
              <tbody>
                {people.map((p) => (
                  <tr key={p.person}>
                    <td><strong>{p.person}</strong></td>
                    <td className="num">{m(p.lent)}</td>
                    <td className="num">{m(p.repaidToMe)}</td>
                    <td className="num">{m(p.borrowed)}</td>
                    <td className="num">{m(p.repaidByMe)}</td>
                    <td className={`num ${p.net > 0 ? "pos" : p.net < 0 ? "neg" : "muted"}`}>
                      {p.net > 0
                        ? `owes me ${m(p.net)}`
                        : p.net < 0
                          ? `I owe ${m(-p.net)}`
                          : "settled"}
                    </td>
                    <td>
                      {p.net !== 0 && (
                        <form action={addTransaction} className="inline-form" style={{ flexWrap: "nowrap" }}>
                          <input type="hidden" name="type" value={p.net > 0 ? "repay_in" : "repay_out"} />
                          <input type="hidden" name="person" value={p.person} />
                          <input type="hidden" name="date" value={todayStr()} />
                          <input
                            name="amount"
                            type="number"
                            step="0.01"
                            min="0.01"
                            required
                            placeholder={p.net > 0 ? "They paid" : "I paid"}
                            style={{ width: 100 }}
                          />
                          <select name="currency" defaultValue={cur} style={{ width: 90 }}>
                            <option value="KES">KSh</option>
                            <option value="USD">USD</option>
                          </select>
                          <SubmitButton style={{ height: 36 }} pendingText="Adding…">
                            Add
                          </SubmitButton>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <h2>Loan history</h2>
        <TxTable rows={history} display={cur} />
      </div>
    </>
  );
}
