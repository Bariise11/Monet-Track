export type TxType =
  | "income"
  | "expense"
  | "lent"
  | "borrowed"
  | "repay_in"
  | "repay_out";

export const TX_TYPES: { value: TxType; label: string; hint: string }[] = [
  { value: "income", label: "Income", hint: "Salary, business, money received" },
  { value: "expense", label: "Expense", hint: "Transport, shopping, bills, giving..." },
  { value: "lent", label: "Loan given", hint: "I lent money to someone" },
  { value: "repay_in", label: "Loan repaid to me", hint: "Someone paid me back" },
  { value: "borrowed", label: "Loan taken", hint: "Someone lent me money" },
  { value: "repay_out", label: "I repaid a loan", hint: "I paid someone back" },
];

export const LOAN_TYPES: TxType[] = ["lent", "borrowed", "repay_in", "repay_out"];

export type CategoryKind = "income" | "expense" | "loan";

export interface Category {
  id: number;
  name: string;
  kind: CategoryKind;
  emoji: string;
  color: string;
}

export interface Transaction {
  id: number;
  date: string;
  type: TxType;
  amount: number;
  currency: "KES" | "USD";
  /** amount converted into the display currency */
  converted: number;
  category_id: number | null;
  person: string | null;
  note: string | null;
  category_name: string | null;
  category_emoji: string | null;
  category_color: string | null;
}

export const isInflow = (t: TxType) => t === "income" || t === "borrowed" || t === "repay_in";
