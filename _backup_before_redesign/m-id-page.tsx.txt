import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CopyLink } from "@/components/CopyLink";
import { LocalTime } from "@/components/LocalTime";
import { m } from "@/lib/messages";
import { keysMatch } from "@/lib/secret";
import { getGift } from "@/lib/store";

type Props = PageProps<"/m/[id]">;

export const metadata: Metadata = {
  title: m.meta.manageTitle,
  robots: { index: false, follow: false },
  // The key is in the address, so it must not leak through the Referer header.
  referrer: "no-referrer",
};

async function Manage({ params, searchParams }: Props) {
  const [{ id }, { key }] = await Promise.all([params, searchParams]);
  const gift = await getGift(id);

  if (!gift || typeof key !== "string" || !keysMatch(key, gift.manageKey)) {
    return (
      <div className="flex flex-col gap-3">
        <h1 className="text-3xl font-extrabold">{m.manage.invalidHeading}</h1>
        <p className="text-muted">{m.manage.invalidBody}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-7">
      <h1 className="text-4xl font-extrabold">{m.manage.heading(gift.receiverName)}</h1>

      <div className="panel flex flex-col gap-4">
        <p className="flex items-center gap-3 text-xl font-bold">
          <span
            aria-hidden="true"
            className={`size-3 rounded-full ${gift.openedAt ? "bg-accent" : "border-2 border-muted"}`}
          />
          {gift.openedAt ? m.manage.opened : m.manage.notOpened}
        </p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          {gift.openedAt && (
            <>
              <dt className="text-muted">{m.manage.openedAt}</dt>
              <dd>
                <LocalTime iso={gift.openedAt} />
              </dd>
            </>
          )}
          {gift.unlockAt && (
            <>
              <dt className="text-muted">{m.manage.unlocksAt}</dt>
              <dd>
                <LocalTime iso={gift.unlockAt} />
              </dd>
            </>
          )}
          <dt className="text-muted">{m.manage.createdAt}</dt>
          <dd>
            <LocalTime iso={gift.createdAt} />
          </dd>
        </dl>
        {!gift.openedAt && <p className="text-sm text-muted">{m.manage.refreshHint}</p>}
      </div>

      <CopyLink label={m.manage.shareLabel} hint={m.manage.shareHint} path={`/g/${gift.id}`} />
    </div>
  );
}

export default function ManagePage({ params, searchParams }: Props) {
  return (
    <main className="mx-auto flex max-w-md flex-col gap-8 px-5 py-10">
      <Link href="/" className="text-sm font-bold uppercase tracking-[0.2em] text-accent">
        {m.brand}
      </Link>
      <Suspense fallback={<div className="min-h-64" />}>
        <Manage params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
