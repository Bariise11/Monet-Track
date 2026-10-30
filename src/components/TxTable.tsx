import Link from "next/link";
import SubmitButton from "@/components/SubmitButton";
import ConfirmForm from "@/components/ConfirmForm";
import { deleteTransaction } from "@/lib/actions";
import { money, type Currency } from "@/lib/currency";
import { TX_TYPES, isInflow, type Transaction } from "@/lib/types";

const label = (t: Transaction["type"]) => TX_TYPES.find((x) => x.value === t)?.label ?? t;

export default function TxTable({ rows, display }: { rows: Transaction[]; display: Currency }) {
  if (rows.length === 0) return <p className="muted">No transactions found.</p>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Type</th>
            <th>Category</th>
            <th>Details</th>
            <th className="num">Amount</th>
            <th className="num">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.id}>
              <td>{t.date}</td>
              <td>
                <span className={`pill ${isInflow(t.type) ? "in" : "out"}`}>{label(t.type)}</span>
              </td>
              <td>
                {t.category_emoji} {t.category_name}
              </td>
              <td>
                {t.person && <strong>{t.person}</strong>}
                {t.person && t.note ? " · " : ""}
                {t.note}
              </td>
              <td className={`num ${isInflow(t.type) ? "pos" : "neg"}`}>
                {isInflow(t.type) ? "+" : "−"}
                {money(t.amount, t.currency)}
                {t.currency !== display && (
                  <div className="muted" style={{ fontSize: "0.72rem" }}>
                    ≈ {money(t.converted, display)}
                  </div>
                )}
              </td>
              <td>
                <div className="row-actions">
                  <Link href={`/transactions/${t.id}/edit`} className="btn sm">
                    Edit
                  </Link>
                  <ConfirmForm
                    action={deleteTransaction.bind(null, t.id)}
                    message="Delete this transaction? This cannot be undone."
                  >
                    <SubmitButton className="btn sm danger" pendingText="Deleting…">Delete</SubmitButton>
                  </ConfirmForm>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
