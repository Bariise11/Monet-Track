"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { addTransaction, updateTransaction } from "@/lib/actions";
import type { Currency } from "@/lib/currency";
import {
  LOAN_TYPES,
  TX_TYPES,
  type Category,
  type Transaction,
  type TxType,
} from "@/lib/types";

export default function TransactionForm({
  categories,
  today,
  defaultCurrency,
  loanPeople,
  initial,
}: {
  categories: Category[];
  today: string;
  defaultCurrency: Currency;
  loanPeople: string[];
  /** when set, the form edits this transaction instead of adding a new one */
  initial?: Transaction;
}) {
  const router = useRouter();
  const [type, setType] = useState<TxType>(initial?.type ?? "expense");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const ref = useRef<HTMLFormElement>(null);

  const isLoan = LOAN_TYPES.includes(type);
  const kind = type === "income" ? "income" : "expense";
  const cats = categories.filter((c) => c.kind === kind);
  const currency = initial?.currency ?? defaultCurrency;

  function submit(fd: FormData) {
    setError("");
    start(async () => {
      try {
        if (initial) {
          await updateTransaction(initial.id, fd);
          router.push("/transactions");
        } else {
          await addTransaction(fd);
          ref.current?.reset();
          setType("expense");
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  return (
    <form ref={ref} action={submit} className="card form-grid" id="add-transaction">
      <h2>{initial ? "Edit transaction" : "Add transaction"}</h2>
      <div className="type-tabs">
        {TX_TYPES.map((t) => (
          <button
            type="button"
            key={t.value}
            className={type === t.value ? "tab active" : "tab"}
            onClick={() => setType(t.value)}
            title={t.hint}
          >
            {t.label}
          </button>
        ))}
      </div>
      <input type="hidden" name="type" value={type} />

      <label>
        Amount
        <input
          name="amount"
          type="number"
          step="0.01"
          min="0.01"
          required
          placeholder="0.00"
          defaultValue={initial?.amount}
        />
      </label>
      <label>
        Currency
        <select name="currency" key={currency} defaultValue={currency}>
          <option value="KES">KSh (Kenyan Shilling)</option>
          <option value="USD">$ (US Dollar)</option>
        </select>
      </label>
      <label>
        Date
        <input name="date" type="date" defaultValue={initial?.date ?? today} required />
      </label>

      {isLoan ? (
        <label>
          Person
          <input
            name="person"
            required
            placeholder="Pick an existing name or type new"
            list="loan-people"
            autoComplete="off"
            defaultValue={initial?.person ?? ""}
          />
          <datalist id="loan-people">
            {loanPeople.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </label>
      ) : (
        <>
          <label>
            Category
            <select
              name="category_id"
              required
              key={kind}
              defaultValue={
                initial && cats.some((c) => c.id === initial.category_id)
                  ? String(initial.category_id)
                  : ""
              }
            >
              <option value="" disabled>
                Select…
              </option>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.emoji} {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {type === "income" ? "From (optional)" : "Paid to / for (optional)"}
            <input
              name="person"
              placeholder="e.g. Uber, Mom, Store"
              defaultValue={initial?.person ?? ""}
            />
          </label>
        </>
      )}
      <label className="wide">
        Note
        <input name="note" placeholder="Optional details" defaultValue={initial?.note ?? ""} />
      </label>
      {error && <p className="error wide">{error}</p>}
      <button className="btn primary wide" disabled={pending}>
        {pending ? "Saving…" : initial ? "Save changes" : "Save"}
      </button>
    </form>
  );
}
