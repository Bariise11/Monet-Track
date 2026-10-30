export type Currency = "KES" | "USD";

export const CURRENCIES: { code: Currency; label: string; symbol: string }[] = [
  { code: "KES", label: "Kenyan Shilling", symbol: "KSh" },
  { code: "USD", label: "US Dollar", symbol: "$" },
];

export function money(n: number, cur: Currency = "KES"): string {
  const abs = Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const sym = cur === "USD" ? "$" : "KSh ";
  return `${n < 0 ? "-" : ""}${sym}${abs}`;
}
