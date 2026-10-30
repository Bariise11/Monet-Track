import { getUser } from "@/lib/auth";
import { getTransactions } from "@/lib/queries";

export const dynamic = "force-dynamic";

const esc = (v: string | number | null) => `"${String(v ?? "").replace(/"/g, '""')}"`;

export async function GET(req: Request) {
  const user = await getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const sp = new URL(req.url).searchParams;
  const m = sp.get("m");
  const rows = getTransactions(user.id, {
    month: m && /^\d{4}-\d{2}$/.test(m) ? m : undefined,
    from: sp.get("from") || undefined,
    to: sp.get("to") || undefined,
    type: sp.get("type") || undefined,
    categoryId: Number(sp.get("cat")) || undefined,
    q: sp.get("q") || undefined,
  });
  const lines = [
    "date,type,category,person,note,amount,currency",
    ...rows.map((r) =>
      [r.date, r.type, r.category_name, r.person, r.note, r.amount, r.currency].map(esc).join(","),
    ),
  ];
  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="transactions.csv"',
    },
  });
}
