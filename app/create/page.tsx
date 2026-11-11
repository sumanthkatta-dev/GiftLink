import type { Metadata } from "next";
import { SiteHeader } from "@/components/Brand";
import { CreateForm } from "@/components/CreateForm";
import { m } from "@/lib/messages";

export const metadata: Metadata = { title: m.meta.createTitle };

export default function CreatePage() {
  return (
    <div className="min-h-dvh">
      <SiteHeader />
      <main className="mx-auto max-w-[1040px] px-5 pb-20 pt-10 sm:px-6">
        <CreateForm />
      </main>
    </div>
  );
}
