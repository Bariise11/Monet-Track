import { requireUser } from "@/lib/auth";
import SubmitButton from "@/components/SubmitButton";
import ConfirmForm from "@/components/ConfirmForm";
import { addCategory, deleteCategory } from "@/lib/actions";
import { getCategories } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function Categories() {
  const uid = (await requireUser()).id;
  const cats = getCategories(uid);
  const groups = [
    { title: "Expense categories", items: cats.filter((c) => c.kind === "expense") },
    { title: "Income categories", items: cats.filter((c) => c.kind === "income") },
    { title: "Loans (automatic)", items: cats.filter((c) => c.kind === "loan") },
  ];

  return (
    <>
      <h1>Categories</h1>

      <form action={addCategory} className="card inline-form">
        <label>
          Name
          <input name="name" required placeholder="e.g. Gym" />
        </label>
        <label style={{ maxWidth: 120 }}>
          Emoji
          <input name="emoji" placeholder="🏋️" maxLength={4} />
        </label>
        <label style={{ maxWidth: 140 }}>
          Type
          <select name="kind" defaultValue="expense">
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </select>
        </label>
        <label style={{ maxWidth: 90 }}>
          Color
          <input name="color" type="color" defaultValue="#4f46e5" style={{ padding: 2, height: 38 }} />
        </label>
        <SubmitButton pendingText="Adding…">Add category</SubmitButton>
      </form>

      {groups.map((g) => (
        <div className="card" key={g.title}>
          <h2>{g.title}</h2>
          {g.items.map((c) => (
            <div key={c.id} className="legend-row">
              <span className="dot" style={{ background: c.color }} />
              <span className="grow">{c.emoji} {c.name}</span>
              {c.kind !== "loan" && (
                <ConfirmForm action={deleteCategory.bind(null, c.id)} message={`Delete category "${c.name}"?`}>
                  <SubmitButton className="btn sm danger" pendingText="Deleting…" title="Only categories with no transactions can be deleted">Delete</SubmitButton>
                </ConfirmForm>
              )}
            </div>
          ))}
        </div>
      ))}
      <p className="muted">A category that already has transactions cannot be deleted.</p>
    </>
  );
}
