import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type CSSProperties, type ReactNode } from "react";
import { Brand } from "@/components/Brand";
import { Countdown } from "@/components/Countdown";
import { EmptyState } from "@/components/EmptyState";
import { IconCheck, IconClock, IconExternal, IconLock, IconPlus } from "@/components/icons";
import { LocalTime } from "@/components/LocalTime";
import { RefreshLink } from "@/components/RefreshLink";
import { ShareRow } from "@/components/ShareRow";
import { m } from "@/lib/messages";
import { keysMatch } from "@/lib/secret";
import { getGift, type Gift } from "@/lib/store";

type Props = PageProps<"/m/[id]">;
type Status = "opened" | "scheduled" | "waiting";

export const metadata: Metadata = {
  title: m.meta.manageTitle,
  robots: { index: false, follow: false },
  // The key is in the address, so it must not leak through the Referer header.
  referrer: "no-referrer",
};

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Entrance order for the staggered arrival. */
const order = (i: number) => ({ "--d": `${i * 70}ms` }) as CSSProperties;

/* ------------------------------------------------------------------ Pieces */

function Card({ children, className = "", i }: { children: ReactNode; className?: string; i: number }) {
  return (
    <section
      style={order(i)}
      className={`arrive ui-card p-5 sm:p-6 ${className}`}
    >
      {children}
    </section>
  );
}

function CardTitle({ id, children, aside }: { id: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-5 flex items-center justify-between gap-3">
      <h2 id={id} className="text-[15px] font-semibold text-fg">
        {children}
      </h2>
      {aside}
    </div>
  );
}

function StatusBadge({ status, label }: { status: Status; label: string }) {
  const tone =
    status === "opened"
      ? "border-accent/40 bg-accent/10 text-accent"
      : "border-line-strong bg-surface-2 text-fg-muted";
  return (
    <span className={`inline-flex h-8 items-center gap-2 rounded-full border pl-2.5 pr-3.5 text-[13px] font-medium ${tone}`}>
      {status === "opened" ? (
        <IconCheck className="size-4" />
      ) : status === "scheduled" ? (
        <IconClock className="size-4" />
      ) : (
        <span aria-hidden="true" className="relative grid size-4 place-items-center">
          <span className="ping absolute size-2 rounded-full bg-fg-muted/70" />
          <span className="size-2 rounded-full bg-fg-muted" />
        </span>
      )}
      {label}
    </span>
  );
}

interface Step {
  label: string;
  done: boolean;
  time: string | null;
}

/** Wrapped → (Unlocks) → Opened, with a line that fills up to where the gift is now. */
function Tracker({ steps }: { steps: Step[] }) {
  const doneCount = steps.filter((s) => s.done).length;
  const progress = steps.length > 1 ? Math.max(0, doneCount - 1) / (steps.length - 1) : 1;
  const inset = `calc(100% / ${steps.length * 2})`;

  return (
    <ol className="relative grid" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
      <div aria-hidden="true" className="absolute top-[11px] h-px bg-line-strong" style={{ left: inset, right: inset }}>
        <div
          className="track-fill h-full bg-accent"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
      {steps.map((step, index) => {
        const current = !step.done && index === doneCount;
        return (
          <li key={step.label} className="relative flex flex-col items-center gap-3 text-center">
            <span className="relative grid size-[23px] place-items-center">
              {current && <span aria-hidden="true" className="ping absolute inset-0 rounded-full border border-accent" />}
              <span
                className={`relative grid size-[23px] place-items-center rounded-full border transition-colors ${
                  step.done
                    ? "border-accent bg-accent text-accent-ink"
                    : current
                      ? "border-accent bg-canvas"
                      : "border-line-strong bg-canvas"
                }`}
              >
                {step.done ? (
                  <IconCheck className="size-3.5" />
                ) : (
                  <span className={`size-1.5 rounded-full ${current ? "bg-accent" : "bg-line-strong"}`} />
                )}
              </span>
            </span>
            <span className="flex flex-col gap-1">
              <span className={`text-[14px] font-medium ${step.done || current ? "text-fg" : "text-fg-muted"}`}>{step.label}</span>
              <span className="text-[12px] tabular-nums text-fg-muted">
                {step.time ? <LocalTime iso={step.time} /> : m.manage.stepPending}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function Destination({ gift }: { gift: Gift }) {
  const host = hostOf(gift.url);
  return (
    <a
      href={gift.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block overflow-hidden rounded-control border border-line bg-canvas transition-colors hover:border-line-strong"
    >
      <div className="relative aspect-[1.91/1] overflow-hidden border-b border-line bg-surface-2">
        {gift.ogImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote preview of an arbitrary site
          <img
            src={gift.ogImage}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            className="size-full object-cover opacity-90 transition-[transform,opacity] duration-700 ease-out group-hover:scale-[1.03] group-hover:opacity-100"
          />
        ) : (
          <div className="grid size-full place-items-center">
            <span className="text-[13px] text-fg-muted">{m.manage.noPreview}</span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-3 p-3.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-line bg-surface-2 text-[13px] font-medium uppercase text-fg-muted">
          {host.charAt(0)}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[14px] font-medium text-fg">{gift.ogTitle ?? host}</span>
          <span className="truncate text-[12px] text-fg-muted">{host}</span>
        </span>
        <IconExternal className="size-4 shrink-0 text-fg-muted transition-colors duration-300 group-hover:text-fg" />
        <span className="sr-only">{m.manage.openLink}</span>
      </div>
    </a>
  );
}

function Property({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line py-3 text-[14px] last:border-0 last:pb-0 first:pt-0">
      <dt className="shrink-0 text-fg-muted">{label}</dt>
      <dd className="min-w-0 truncate text-right text-fg">{children}</dd>
    </div>
  );
}

/* --------------------------------------------------------------- Dashboard */

function Dashboard({ gift, manageHref }: { gift: Gift; manageHref: string }) {
  const locked = gift.unlockAt ? Date.parse(gift.unlockAt) > Date.now() : false;
  const status: Status = gift.openedAt ? "opened" : locked ? "scheduled" : "waiting";
  const statusLabel = { opened: m.manage.opened, scheduled: m.manage.scheduled, waiting: m.manage.notOpened }[status];

  const steps: Step[] = [
    { label: m.manage.stepWrapped, done: true, time: gift.createdAt },
    ...(gift.unlockAt
      ? [{ label: locked ? m.manage.stepUnlocks : m.manage.stepUnlocked, done: !locked, time: gift.unlockAt }]
      : []),
    { label: m.manage.stepOpened, done: Boolean(gift.openedAt), time: gift.openedAt },
  ];

  return (
    <div className="flex flex-col gap-5">
      <header style={order(0)} className="arrive mb-5 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 flex-col gap-3">
          <p className="text-[13px] text-fg-muted">
            {m.manage.eyebrow} <span aria-hidden="true">·</span> <span className="font-mono text-[12px]">{gift.id}</span>
          </p>
          <h1 className="text-[34px] font-semibold leading-[1.05] tracking-[-0.035em] text-fg sm:text-[44px]">
            {m.manage.title(gift.receiverName)}
          </h1>
          <p className="text-[15px] text-fg-muted">{m.manage.byline(gift.senderName)}</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <StatusBadge status={status} label={statusLabel} />
          {status !== "opened" && <RefreshLink href={manageHref} />}
        </div>
      </header>

      <Card i={1}>
        <CardTitle id="progress">{m.manage.progress}</CardTitle>
        <div aria-labelledby="progress">
          <Tracker steps={steps} />
        </div>
        {locked && gift.unlockAt && (
          <div className="mt-6 border-t border-line pt-5">
            <Countdown iso={gift.unlockAt} />
          </div>
        )}
        {status !== "opened" && (
          <p className="mt-5 text-center text-[13px] text-fg-muted">{m.manage.refreshHint}</p>
        )}
      </Card>

      <Card i={2}>
        <ShareRow path={`/g/${gift.id}`} />
      </Card>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          {gift.note && (
            <Card i={3}>
              <CardTitle id="note">{m.manage.note}</CardTitle>
              <blockquote aria-labelledby="note" className="relative border-l border-line-strong pl-5 text-fg">
                <p className="whitespace-pre-wrap font-serif text-[19px] leading-snug">{gift.note}</p>
                <footer className="mt-3 text-[14px] text-fg-muted">{gift.senderName}</footer>
              </blockquote>
            </Card>
          )}

          <Card i={4}>
            <CardTitle id="details">{m.manage.details}</CardTitle>
            <dl aria-labelledby="details">
              <Property label={m.manage.wrap}>
                {m.manage.wraps[gift.wrapStyle]}
              </Property>
              <Property label={m.manage.unlock}>
                {gift.unlockAt ? <LocalTime iso={gift.unlockAt} /> : m.manage.unlockNone}
              </Property>
              <Property label={m.manage.question}>{gift.secretQuestion ?? m.manage.questionNone}</Property>
              <Property label={m.manage.created}>
                <LocalTime iso={gift.createdAt} />
              </Property>
              {gift.openedAt && (
                <Property label={m.manage.openedAt}>
                  <LocalTime iso={gift.openedAt} />
                </Property>
              )}
            </dl>
          </Card>
        </div>

        <Card i={3} className="self-start">
          <CardTitle id="destination">{m.manage.destination}</CardTitle>
          <Destination gift={gift} />
        </Card>
      </div>
    </div>
  );
}

async function Manage({ params, searchParams }: Props) {
  const [{ id }, { key }] = await Promise.all([params, searchParams]);
  const gift = await getGift(id);

  if (!gift || typeof key !== "string" || !keysMatch(key, gift.manageKey)) {
    return (
      <div className="pt-16">
        <EmptyState
          icon={<IconLock className="size-6" />}
          heading={m.manage.invalidHeading}
          body={m.manage.invalidBody}
          action={{ href: "/create", label: m.manage.invalidCta }}
          secondary={{ href: "/", label: m.manage.invalidHome }}
        />
      </div>
    );
  }

  return <Dashboard gift={gift} manageHref={`/m/${gift.id}?key=${encodeURIComponent(key)}`} />;
}

/* -------------------------------------------------------------------- Page */

export default function ManagePage({ params, searchParams }: Props) {
  return (
    <div className="relative min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-line/70 bg-canvas">
        <div className="mx-auto flex h-14 max-w-[1040px] items-center justify-between gap-4 px-4 sm:px-6">
          <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2.5 text-[14px]">
            <Brand />
            <span aria-hidden="true" className="text-line-strong">/</span>
            <span className="truncate text-fg-muted">{m.manage.breadcrumb}</span>
          </nav>
          <Link href="/create" className="group ui-button ui-button-sm ui-button-primary shrink-0">
            <IconPlus className="size-4 transition-transform duration-500 ease-spring group-hover:rotate-90" />
            {m.manage.newGift}
          </Link>
        </div>
      </header>

      <main className="relative mx-auto max-w-[1040px] px-4 pb-24 pt-10 sm:px-6 sm:pt-14">
        <Suspense fallback={<div className="min-h-64" />}>
          <Manage params={params} searchParams={searchParams} />
        </Suspense>
      </main>
    </div>
  );
}
