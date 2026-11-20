import { requireUser } from "@/lib/auth";
import { Flash } from "@/components/flash";
import { GroupFields } from "@/components/group-fields";
import { Submit } from "@/components/client";
import { createGroupAction } from "../../actions";

export default async function NovaPelada({ searchParams }: PageProps<"/g/nova">) {
  await requireUser("/g/nova");
  const sp = await searchParams;
  return (
    <div>
      <h1 className="mb-4 text-2xl font-black italic">Criar pelada</h1>
      <Flash sp={sp} />
      <form action={createGroupAction} className="card space-y-4">
        <GroupFields />
        <Submit className="btn w-full py-3">Criar pelada</Submit>
      </form>
    </div>
  );
}
