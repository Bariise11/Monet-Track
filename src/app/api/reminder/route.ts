import { getUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

/** How many transactions the signed-in user has dated `today` (the browser's local date). */
export async function GET(req: Request) {
  const user = await getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const today = new URL(req.url).searchParams.get("today") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) return new Response("Bad date", { status: 400 });
  const { n } = getDb()
    .prepare("SELECT COUNT(*) AS n FROM transactions WHERE user_id = ? AND date = ?")
    .get(user.id, today) as { n: number };
  return Response.json({ count: n });
}
