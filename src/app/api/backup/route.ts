import { getUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

/** A JSON copy of the signed-in user's own data (never anyone else's). */
export async function GET() {
  const user = await getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const db = getDb();
  const data = {
    exportedAt: new Date().toISOString(),
    user: { name: user.name, email: user.email },
    categories: db.prepare("SELECT id, name, kind, emoji, color FROM categories WHERE user_id = ?").all(user.id),
    transactions: db
      .prepare(
        "SELECT id, date, type, amount, currency, category_id, person, note FROM transactions WHERE user_id = ? ORDER BY date, id",
      )
      .all(user.id),
    openingBalances: db
      .prepare("SELECT month, currency, amount FROM opening_balances WHERE user_id = ? ORDER BY month")
      .all(user.id),
  };
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="money-data-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
