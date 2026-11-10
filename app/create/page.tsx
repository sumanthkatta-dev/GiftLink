import type { Metadata } from "next";
import { CreateForm } from "@/components/CreateForm";
import { m } from "@/lib/messages";

export const metadata: Metadata = { title: m.meta.createTitle };

export default function CreatePage() {
  return (
    <main className="mx-auto max-w-md px-5 py-10">
      <CreateForm />
    </main>
  );
}
