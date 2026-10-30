import { requireUser } from "@/lib/auth";
import Link from "next/link";
import SubmitButton from "@/components/SubmitButton";
import ConfirmForm from "@/components/ConfirmForm";
import { deleteTransaction } from "@/lib/actions";
import { notFound, redirect } from "next/navigation";
import TransactionForm from "@/components/TransactionForm";
import { todayStr } from "@/lib/format";
import { getCategories, getLoansByPerson, getTransaction } from "@/lib/queries";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function EditTransaction({ params }: { params: Promise<{ id: string }> }) {
  const uid = (await requireUser()).id;
  const tx = getTransaction(uid, Number((await params).id));
  if (!tx) notFound();
  return (
    <>
      <div className="page-head">
        <h1>Edit transaction</h1>
        <div className="row-actions">
          <Link href="/transactions" className="btn">
            ← Cancel
          </Link>
          <ConfirmForm
            action={async () => {
              "use server";
              await deleteTransaction(tx.id);
              redirect("/transactions");
            }}
            message="Delete this transaction? This cannot be undone."
          >
            <SubmitButton className="btn danger" pendingText="Deleting…">Delete</SubmitButton>
          </ConfirmForm>
        </div>
      </div>
      <TransactionForm
        key={tx.id}
        initial={tx}
        categories={getCategories(uid)}
        today={todayStr()}
        defaultCurrency={getSettings(uid).display}
        loanPeople={getLoansByPerson(uid).map((p) => p.person)}
      />
    </>
  );
}
