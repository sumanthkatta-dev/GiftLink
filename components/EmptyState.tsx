import Link from "next/link";
import type { ReactNode } from "react";

/** A quiet full-page message with one clear next step: not found, invalid key and the like. */
export function EmptyState({
  icon,
  heading,
  body,
  action,
  secondary,
}: {
  icon: ReactNode;
  heading: string;
  body: string;
  action: { href: string; label: string };
  secondary?: { href: string; label: string };
}) {
  return (
    <div className="arrive mx-auto flex w-full max-w-sm flex-col items-center gap-4 text-center">
      <span aria-hidden="true" className="mb-2 grid size-14 place-items-center rounded-2xl border border-line bg-surface text-fg-muted shadow-card">
        {icon}
      </span>
      <h1 className="text-[24px] font-semibold leading-tight">{heading}</h1>
      <p className="text-[15px] leading-relaxed text-fg-muted">{body}</p>
      <div className="mt-4 flex w-full flex-col gap-2">
        <Link href={action.href} className="ui-button ui-button-primary w-full">
          {action.label}
        </Link>
        {secondary && (
          <Link href={secondary.href} className="ui-button ui-button-quiet w-full">
            {secondary.label}
          </Link>
        )}
      </div>
    </div>
  );
}
