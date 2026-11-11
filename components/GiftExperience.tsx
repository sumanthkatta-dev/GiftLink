"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { checkAnswerAction, revealGiftAction, type RevealedGift } from "@/app/actions";
import { Celebration, haptic, type CelebrationHandle } from "@/components/celebration/Celebration";
import { scheduleChime } from "@/components/celebration/sound";
import { IconLock, IconSoundOff, IconSoundOn } from "@/components/icons";
import { formatLocal } from "@/components/LocalTime";
import { Wrap } from "@/components/wraps/Wrap";
import { m } from "@/lib/messages";
import type { WrapStyle } from "@/lib/wraps";

type Stage = "locked" | "question" | "wrapped" | "opening" | "revealed";

export interface GiftExperienceProps {
  id: string;
  senderName: string;
  receiverName: string;
  wrapStyle: WrapStyle;
  /** ISO 8601 in UTC, or null. */
  unlockAt: string | null;
  secretQuestion: string | null;
  /** Whether the unlock time was still ahead when the server rendered the page. */
  lockedAtRender: boolean;
  /** The server's clock when it rendered the page, in ms. Used to correct a wrong phone clock. */
  serverNow: number;
}

/** How long the opening plays before the reveal, in ms. The gift is fetched meanwhile. */
const OPEN_ANIMATION_MS = 2100;
/** When each wrap's opening peaks and the celebration fires, measured from the tap. */
const BURST_AT_MS: Record<WrapStyle, number> = { card: 1420, envelope: 1520, ticket: 1600 };
/** Where on the wrap the light comes from, as a share of its height. */
const BURST_ORIGIN_Y: Record<WrapStyle, number> = { card: 0.48, envelope: 0.36, ticket: 0.38 };
const SOUND_KEY = "giftlink:sound";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ------------------------------------------------------------------ Countdown

function Countdown({ unlockAt, skew, onDone }: { unlockAt: string; skew: number | null; onDone: () => void }) {
  const target = Date.parse(unlockAt);
  // Stays null until the browser takes over, so server and client HTML match.
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    // `skew` moves the phone's clock onto the server's, so a wrong phone clock can't end the wait early.
    // Until the correction is known, show nothing rather than risk ending the wait early.
    if (skew === null) return;
    const tick = () => setNow(Date.now() + skew);
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [skew]);

  const remaining = now === null ? null : Math.max(0, target - now);

  useEffect(() => {
    if (remaining === 0) onDone();
  }, [remaining, onDone]);

  const seconds = Math.floor((remaining ?? 0) / 1000);
  const units: [number, string][] = [
    [Math.floor(seconds / 86400), m.gift.days],
    [Math.floor((seconds % 86400) / 3600), m.gift.hours],
    [Math.floor((seconds % 3600) / 60), m.gift.minutes],
    [seconds % 60, m.gift.seconds],
  ];

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div className="ui-card grid w-full grid-cols-4 divide-x divide-line" role="timer">
        {units.map(([value, label]) => (
          <div key={label} className="flex flex-col items-center gap-1 py-5">
            <span className="text-[30px] font-medium leading-none tracking-[-0.03em] tabular-nums" aria-hidden={remaining === null}>
              <span key={remaining === null ? "none" : value} className="digit-in">
                {remaining === null ? "--" : String(value).padStart(2, "0")}
              </span>
            </span>
            <span className="text-[13px] text-fg-muted">{label}</span>
          </div>
        ))}
      </div>
      <p className="min-h-6 text-[15px] text-fg-muted">
        {remaining !== null && <time dateTime={unlockAt}>{m.gift.opensAt(formatLocal(unlockAt))}</time>}
      </p>
    </div>
  );
}

// ------------------------------------------------------------------ Sound

function SoundToggle({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => onChange(!on)}
      className="ui-button ui-button-sm ui-button-quiet fixed right-3 top-3 z-50 bg-canvas/80"
    >
      {on ? <IconSoundOn className="size-4" /> : <IconSoundOff className="size-4" />}
      {on ? m.gift.soundOn : m.gift.soundOff}
    </button>
  );
}

// --------------------------------------------------------------- Experience

export function GiftExperience(props: GiftExperienceProps) {
  const { id, senderName, receiverName, wrapStyle, unlockAt, secretQuestion, lockedAtRender, serverNow } = props;
  const afterLock: Stage = secretQuestion ? "question" : "wrapped";

  const [stage, setStage] = useState<Stage>(lockedAtRender ? "locked" : afterLock);
  const [answer, setAnswer] = useState("");
  const [wrongAnswer, setWrongAnswer] = useState(false);
  const [failed, setFailed] = useState(false);
  const [gift, setGift] = useState<RevealedGift | null>(null);
  const [checking, startChecking] = useTransition();
  const [sound, setSound] = useState(false);
  // How far the server's clock is ahead of this phone's, in ms. Measured once the page is live.
  const [skew, setSkew] = useState<number | null>(null);
  useEffect(() => {
    setSkew(serverNow - Date.now());
  }, [serverNow]);

  // Sound is off unless this viewer turned it on before.
  useEffect(() => {
    try {
      if (localStorage.getItem(SOUND_KEY) === "on") setSound(true);
    } catch {
      // Storage blocked: stay silent.
    }
  }, []);
  function changeSound(on: boolean) {
    setSound(on);
    try {
      localStorage.setItem(SOUND_KEY, on ? "on" : "off");
    } catch {
      // Not remembered, but still applies to this visit.
    }
  }

  const celebration = useRef<CelebrationHandle>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const burstTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const flipFrom = useRef<number | null>(null);
  useEffect(() => () => clearTimeout(burstTimer.current), []);

  // When the reveal content arrives below the wrap, the wrap glides up to its new place instead of jumping.
  useLayoutEffect(() => {
    const el = topRef.current;
    const from = flipFrom.current;
    flipFrom.current = null;
    if (stage !== "revealed" || !el || from === null || prefersReducedMotion()) return;
    const dy = from - el.getBoundingClientRect().top;
    if (Math.abs(dy) < 1) return;
    const spring = getComputedStyle(document.documentElement).getPropertyValue("--ease-spring").trim();
    const frames = [{ transform: `translateY(${dy}px)` }, { transform: "translateY(0)" }];
    try {
      el.animate(frames, { duration: 900, easing: spring || "ease-out" });
    } catch {
      el.animate(frames, { duration: 700, easing: "cubic-bezier(0.22, 1, 0.36, 1)" });
    }
  }, [stage]);

  function submitAnswer(event: FormEvent) {
    event.preventDefault();
    setFailed(false);
    startChecking(async () => {
      try {
        const correct = await checkAnswerAction(id, answer);
        setWrongAnswer(!correct);
        if (correct) setStage("wrapped");
      } catch {
        setFailed(true);
      }
    });
  }

  function celebrate() {
    const box = wrapRef.current?.getBoundingClientRect();
    const x = box ? box.left + box.width / 2 : window.innerWidth / 2;
    const y = box ? box.top + box.height * BURST_ORIGIN_Y[wrapStyle] : window.innerHeight / 2;
    celebration.current?.fire(x, y);
  }

  async function unwrap() {
    if (stage !== "wrapped") return;
    setFailed(false);
    setStage("opening");
    const reducedMotion = prefersReducedMotion();
    // A short tap on phones that support it. Ignored everywhere else.
    haptic(12);
    if (sound) scheduleChime(wrapStyle, reducedMotion ? 0 : BURST_AT_MS[wrapStyle]);
    if (!reducedMotion) burstTimer.current = setTimeout(celebrate, BURST_AT_MS[wrapStyle]);
    try {
      // The gift's contents are fetched while the animation plays.
      const [result] = await Promise.all([
        revealGiftAction(id, answer),
        wait(reducedMotion ? 400 : OPEN_ANIMATION_MS),
      ]);
      if (result.status === "ok") {
        flipFrom.current = topRef.current?.getBoundingClientRect().top ?? null;
        setGift(result.gift);
        setStage("revealed");
      } else if (result.status === "locked") {
        // The server says it is too early, so trust its clock and go back to waiting.
        clearTimeout(burstTimer.current);
        setSkew(result.serverNow - Date.now());
        setStage("locked");
      } else if (result.status === "wrong_answer") {
        clearTimeout(burstTimer.current);
        setWrongAnswer(true);
        setStage("question");
      } else {
        clearTimeout(burstTimer.current);
        setFailed(true);
        setStage("wrapped");
      }
    } catch {
      clearTimeout(burstTimer.current);
      setFailed(true);
      setStage("wrapped");
    }
  }

  const errorLine = failed && (
    <p role="alert" className="text-[15px] font-medium text-danger">
      {m.gift.error}
    </p>
  );

  let content;

  if (stage === "locked" && unlockAt) {
    content = (
      <section className="arrive flex w-full flex-col items-center gap-9 text-center">
        <Wrap kind={wrapStyle} size="small" state="closed" idle note={null} receiverName={receiverName} senderName={senderName} seed={id} />
        <div className="flex flex-col gap-2">
          <h1 className="text-[28px] font-semibold leading-tight">{m.gift.lockedHeading(senderName)}</h1>
          <p className="text-[17px] text-fg-muted">{m.gift.lockedBody}</p>
        </div>
        <Countdown unlockAt={unlockAt} skew={skew} onDone={() => setStage(afterLock)} />
        <p className="text-[13px] text-fg-muted">{m.gift.lockedHint}</p>
      </section>
    );
  } else if (stage === "question" && secretQuestion) {
    content = (
      <form onSubmit={submitAnswer} className="arrive flex w-full flex-col gap-7">
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="grid size-12 place-items-center rounded-full border border-line bg-surface text-fg-muted">
            <IconLock />
          </span>
          <p className="text-[15px] text-fg-muted">{m.gift.questionHeading(senderName)}</p>
          <h1 className="font-serif text-[32px] leading-[1.15] tracking-normal">{secretQuestion}</h1>
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="answer" className="text-[14px] font-medium">
            {m.gift.answerLabel}
          </label>
          <input
            id="answer"
            className="ui-input"
            value={answer}
            autoComplete="off"
            aria-invalid={wrongAnswer || undefined}
            aria-describedby={wrongAnswer ? "answer-error" : undefined}
            onChange={(event) => {
              setAnswer(event.target.value);
              setWrongAnswer(false);
            }}
          />
          {wrongAnswer && (
            <p id="answer-error" role="alert" className="text-[14px] font-medium text-danger">
              {m.gift.answerWrong}
            </p>
          )}
        </div>
        {errorLine}
        <button type="submit" className="ui-button ui-button-primary" disabled={checking || !answer.trim()}>
          {checking ? m.gift.answerChecking : m.gift.answerSubmit}
        </button>
      </form>
    );
  } else {
    const open = stage === "opening" || stage === "revealed";
    let host = "";
    if (gift) {
      try {
        host = new URL(gift.url).hostname.replace(/^www\./, "");
      } catch {
        // Stored URLs are validated on creation, so this should not happen.
      }
    }
    content = (
      <section className="flex w-full flex-col items-center text-center">
        <div ref={topRef} className="flex w-full flex-col items-center gap-10">
          <div className="fade-in flex flex-col gap-2">
            <h1 className="text-[30px] font-semibold leading-tight">{m.gift.wrappedHeading(receiverName)}</h1>
            <p className="text-[17px] text-fg-muted">{m.gift.wrappedFrom(senderName)}</p>
          </div>
          <div ref={wrapRef} className="arrive" style={{ ["--d" as string]: "80ms" }}>
            <Wrap
              kind={wrapStyle}
              size="full"
              state={open ? "open" : "closed"}
              play
              idle
              note={gift ? gift.note || m.gift.revealHeading(senderName) : null}
              noteArrives
              receiverName={receiverName}
              senderName={senderName}
              seed={id}
              onOpen={unwrap}
              openLabel={m.gift.openLabel[wrapStyle]}
            />
          </div>
        </div>

        {stage === "revealed" && gift ? (
          <div className="gift-tail mt-12 flex w-full flex-col gap-3 text-left" data-wrap={wrapStyle}>
            <div className="arrive ui-card overflow-hidden" style={{ ["--d" as string]: "140ms" }}>
              {gift.ogImage && (
                // The image lives on someone else's server, so next/image is not used here.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={gift.ogImage}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="aspect-[1.91/1] w-full border-b border-line object-cover"
                  onError={(event) => {
                    event.currentTarget.style.display = "none";
                  }}
                />
              )}
              <div className="flex flex-col gap-1 p-4">
                <p className="sr-only">{m.gift.previewLabel}</p>
                <p className="line-clamp-2 text-[16px] font-medium">{gift.ogTitle || host}</p>
                <p className="text-[14px] text-fg-muted">{host}</p>
              </div>
            </div>

            <a
              href={gift.url}
              target="_blank"
              rel="noopener noreferrer"
              className="arrive ui-button ui-button-primary w-full"
              style={{ ["--d" as string]: "280ms" }}
            >
              {m.gift.open}
            </a>

            <div className="arrive mt-8 flex flex-col items-center gap-2 border-t border-line pt-8" style={{ ["--d" as string]: "420ms" }}>
              <Link href="/create" className="ui-button ui-button-secondary w-full">
                {m.gift.makeOne}
              </Link>
              <p className="pt-2 text-[13px] text-fg-muted">{m.gift.wrappedWith}</p>
            </div>
          </div>
        ) : (
          <div className="mt-12 flex min-h-14 flex-col items-center gap-3">
            <p
              className={`text-[15px] text-fg-muted transition-opacity duration-300 ${open ? "opacity-0" : "hint-breathe"}`}
            >
              {m.gift.tap[wrapStyle]}
            </p>
            {errorLine}
          </div>
        )}
      </section>
    );
  }

  const showSound = stage === "wrapped" || stage === "opening" || stage === "revealed";

  return (
    <main className="stage-light mx-auto flex min-h-dvh w-full max-w-[440px] flex-col items-center justify-center overflow-x-clip px-5 pb-12 pt-16">
      {showSound && <SoundToggle on={sound} onChange={changeSound} />}
      {content}
      <Celebration kind={wrapStyle} ref={celebration} />
    </main>
  );
}
