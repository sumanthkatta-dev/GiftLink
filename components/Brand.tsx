import Link from "next/link";
import type { ReactNode } from "react";
import { IconGift } from "@/components/icons";
import { m } from "@/lib/messages";

/** The GiftLink mark and name, linking home. */
export function Brand() {
  return (
    <Link href="/" className="inline-flex items-center gap-2.5 rounded-lg text-[15px] font-semibold tracking-[-0.01em] text-fg">
      <span aria-hidden="true" className="grid size-7 place-items-center rounded-[8px] bg-fg text-canvas shadow-card">
        <IconGift className="size-4" />
      </span>
      {m.brand}
    </Link>
  );
}

export function SiteHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="border-b border-line/70">
      <div className="mx-auto flex h-14 max-w-[1040px] items-center justify-between gap-4 px-4 sm:px-6">
        <Brand />
        {children}
      </div>
    </header>
  );
}
