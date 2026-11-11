import type { Metadata } from "next";
import { Geist_Mono, Instrument_Sans } from "next/font/google";
import Link from "next/link";
import { Suspense, type CSSProperties, type ReactNode } from "react";
import { Countdown } from "@/components/Countdown";
import { LocalTime } from "@/components/LocalTime";
import { RefreshLink } from "@/components/RefreshLink";
import { ShareRow } from "@/components/ShareRow";
import { m } from "@/lib/messages";
import { keysMatch } from "@/lib/secret";
import { getGift, type Gift } from "@/lib/store";

const sans = Instrument_Sans({ subsets: ["latin"], variable: "--font-dash-sans" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-dash-mono" });

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

/** Entrance order for the staggered rise animation. */
const order = (i: number) => ({ "--i": i }) as CSSProperties;

/* ------------------------------------------------------------------ Pieces */

function Card({ children, className = "", i }: { children: ReactNode; className?: string; i: number }) {
  return (
    <section
      style={order(i)}
      className={`dash-rise dash-card rounded-2xl border border-edge bg-raised/80 p-5 shadow-[0_1px_0_rgb(255_255_255/0.03)_inset,0_20px_40px_-24px_rgb(0_0_0/0.8)] backdrop-blur-sm sm:p-6 ${className}`}
    >
      {children}
    </section>
  );
}

function CardTitle({ id, children, aside }: { id: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-5 flex items-center justify-between gap-3">
      <h2 id={id} className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-fg-3">
        {children}
      </h2>
      {aside}
    </div>
  );
}

function StatusBadge({ status, label }: { status: Status; label: string }) {
  const tone =
    status === "opened"
      ? "border-brand/40 bg-brand/12 text-brand-soft"
      : "border-edge-2 bg-raised-2 text-fg-2";
  return (
    <span className={`inline-flex h-8 items-center gap-2 rounded-full border pl-2.5 pr-3.5 text-[13px] font-medium ${tone}`}>
      {status === "opened" ? (
        <svg aria-hidden="true" className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      ) : status === "scheduled" ? (
        <svg aria-hidden="true" className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 7.5V12l3 2" />
        </svg>
      ) : (
        <span aria-hidden="true" className="relative grid size-3.5 place-items-center">
          <span className="dash-ping absolute size-2 rounded-full bg-brand-soft/70" />
          <span className="size-2 rounded-full bg-brand-soft" />
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
      <div aria-hidden="true" className="absolute top-[11px] h-px bg-edge-2" style={{ left: inset, right: inset }}>
        <div
          className="dash-track-fill h-full bg-gradient-to-r from-brand/50 to-brand shadow-[0_0_12px_rgb(123_108_255/0.7)]"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
      {steps.map((step, index) => {
        const current = !step.done && index === doneCount;
        return (
          <li key={step.label} className="relative flex flex-col items-center gap-3 text-center">
            <span className="relative grid size-[23px] place-items-center">
              {current && <span aria-hidden="true" className="dash-ping absolute inset-0 rounded-full border border-brand" />}
              <span
                className={`relative grid size-[23px] place-items-center rounded-full border transition-colors ${
                  step.done
                    ? "border-brand bg-brand text-white shadow-[0_0_0_4px_rgb(123_108_255/0.15)]"
                    : current
                      ? "border-brand bg-canvas"
                      : "border-edge-2 bg-canvas"
                }`}
              >
                {step.done ? (
                  <svg aria-hidden="true" className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                ) : (
                  <span className={`size-1.5 rounded-full ${current ? "bg-brand" : "bg-edge-2"}`} />
                )}
              </span>
            </span>
            <span className="flex flex-col gap-1">
              <span className={`text-[13px] font-medium ${step.done || current ? "text-fg" : "text-fg-3"}`}>{step.label}</span>
              <span className="font-mono text-[11px] text-fg-3">
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
      className="group block overflow-hidden rounded-xl border border-edge bg-canvas transition-colors hover:border-edge-2"
    >
      <div className="relative aspect-[1.91/1] overflow-hidden border-b border-edge bg-raised-2">
        {gift.ogImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote preview of an arbitrary site
          <img
            src={gift.ogImage}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            className="size-full object-cover opacity-90 transition-[transform,opacity] duration-700 ease-out-expo group-hover:scale-[1.04] group-hover:opacity-100"
          />
        ) : (
          <div className="grid size-full place-items-center bg-[radial-gradient(circle_at_30%_20%,rgb(123_108_255/0.18),transparent_60%)]">
            <span className="font-mono text-[12px] text-fg-3">{m.manage.noPreview}</span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-3 p-3.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-edge bg-raised-2 font-mono text-[13px] uppercase text-fg-2">
          {host.charAt(0)}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[13px] font-medium text-fg">{gift.ogTitle ?? host}</span>
          <span className="truncate font-mono text-[11px] text-fg-3">{host}</span>
        </span>
        <svg aria-hidden="true" className="size-4 shrink-0 text-fg-3 transition-all duration-300 ease-out-expo group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-fg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 17L17 7M8 7h9v9" />
        </svg>
        <span className="sr-only">{m.manage.openLink}</span>
      </div>
    </a>
  );
}

function Property({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-edge/70 py-3 text-[13px] last:border-0 last:pb-0 first:pt-0">
      <dt className="shrink-0 text-fg-3">{label}</dt>
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
      <header style={order(0)} className="dash-rise mb-5 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 flex-col gap-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-fg-3">
            {m.manage.eyebrow} <span className="text-edge-2">/</span> <span className="normal-case tracking-normal text-fg-2">{gift.id}</span>
          </p>
          <h1 className="text-[34px] font-semibold leading-[1.05] tracking-[-0.035em] text-fg sm:text-[44px]">
            {m.manage.title(gift.receiverName)}
          </h1>
          <p className="text-[14px] text-fg-2">{m.manage.byline(gift.senderName)}</p>
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
          <div className="mt-6 border-t border-edge pt-5">
            <Countdown iso={gift.unlockAt} />
          </div>
        )}
        {status !== "opened" && (
          <p className="mt-5 text-center text-[12px] text-fg-3">{m.manage.refreshHint}</p>
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
              <blockquote aria-labelledby="note" className="relative pl-5 text-[15px] leading-relaxed text-fg">
                <span aria-hidden="true" className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-gradient-to-b from-brand to-brand/0" />
                <p className="whitespace-pre-wrap">{gift.note}</p>
                <footer className="mt-3 text-[13px] text-fg-3">— {gift.senderName}</footer>
              </blockquote>
            </Card>
          )}

          <Card i={4}>
            <CardTitle id="details">{m.manage.details}</CardTitle>
            <dl aria-labelledby="details">
              <Property label={m.manage.wrap}>
                {gift.wrapStyle === "envelope" ? m.manage.wrapEnvelope : m.manage.wrapBox}
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
      <div className="dash-rise mx-auto flex max-w-sm flex-col items-center gap-3 pt-24 text-center">
        <span aria-hidden="true" className="mb-2 grid size-12 place-items-center rounded-2xl border border-edge bg-raised text-fg-3">
          <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="5" y="11" width="14" height="9" rx="2" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" />
          </svg>
        </span>
        <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-fg">{m.manage.invalidHeading}</h1>
        <p className="text-[14px] leading-relaxed text-fg-2">{m.manage.invalidBody}</p>
      </div>
    );
  }

  return <Dashboard gift={gift} manageHref={`/m/${gift.id}?key=${encodeURIComponent(key)}`} />;
}

/* -------------------------------------------------------------------- Page */

export default function ManagePage({ params, searchParams }: Props) {
  return (
    <div
      className={`theme-dash ${sans.variable} ${mono.variable} relative min-h-dvh bg-canvas text-fg antialiased selection:bg-brand/40`}
      style={
        {
          fontFamily: "var(--font-dash-sans), system-ui, sans-serif",
          "--font-mono": "var(--font-dash-mono), ui-monospace, monospace",
          "--accent": "var(--color-brand)",
        } as CSSProperties
      }
    >
      <div aria-hidden="true" className="dash-backdrop" />

      <header className="sticky top-0 z-20 border-b border-edge/60 bg-canvas/70 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1040px] items-center justify-between gap-4 px-4 sm:px-6">
          <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2.5 text-[13px]">
            <Link href="/" className="flex shrink-0 items-center gap-2 rounded-md font-semibold tracking-[-0.01em] text-fg">
              <span aria-hidden="true" className="grid size-6 place-items-center rounded-[7px] bg-gradient-to-b from-brand-soft to-brand shadow-[0_0_0_1px_rgb(255_255_255/0.12)_inset,0_4px_14px_-2px_rgb(123_108_255/0.6)]">
                <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 11h16v9H4zM12 11v9M3 7h18v4H3zM12 7c-1.5-3-5-3-5-1s5 1 5 1zM12 7c1.5-3 5-3 5-1s-5 1-5 1z" />
                </svg>
              </span>
              {m.brand}
            </Link>
            <span aria-hidden="true" className="text-edge-2">/</span>
            <span className="truncate text-fg-3">{m.manage.breadcrumb}</span>
          </nav>
          <Link
            href="/create"
            className="group inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-brand px-3 text-[13px] font-medium text-white shadow-[0_1px_0_rgb(255_255_255/0.2)_inset,0_6px_20px_-6px_rgb(123_108_255/0.8)] transition-[filter,transform] hover:brightness-110 active:scale-95"
          >
            <svg aria-hidden="true" className="size-3.5 transition-transform duration-300 ease-out-expo group-hover:rotate-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            {m.manage.newGift}
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-[1040px] px-4 pb-24 pt-12 sm:px-6 sm:pt-16">
        <Suspense fallback={<div className="min-h-64" />}>
          <Manage params={params} searchParams={searchParams} />
        </Suspense>
      </main>
    </div>
  );
}
