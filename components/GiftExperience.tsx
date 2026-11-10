"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { checkAnswerAction, revealGiftAction, type RevealedGift } from "@/app/actions";
import { GiftBoxArt } from "@/components/GiftBoxArt";
import { formatLocal } from "@/components/LocalTime";
import { m } from "@/lib/messages";
import type { WrapStyle } from "@/lib/store";

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

const OPEN_ANIMATION_MS = 2100;
/** When the confetti fires, measured from the tap. Matches the lid leaving the box. */
const CONFETTI_DELAY_MS: Record<WrapStyle, number> = { box: 430, envelope: 900 };
const CONFETTI: Record<WrapStyle, { colors: string[]; count: number }> = {
  box: { colors: ["#F7B32B", "#FF5D8F", "#FFF6E5", "#BDB3D9", "#7CE0C3", "#8E7BFF"], count: 130 },
  envelope: { colors: ["#2D4BFF", "#8FA0FF", "#F7B32B", "#16161A", "#DCD8CF"], count: 70 },
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
    <div className="flex flex-col items-center gap-5">
      <div className="grid w-full grid-cols-4 gap-2" role="timer">
        {units.map(([value, label]) => (
          <div key={label} className="panel flex flex-col items-center gap-1 px-1 py-4">
            <span className="font-heading text-3xl font-extrabold tabular-nums" aria-hidden={remaining === null}>
              <span key={remaining === null ? "none" : value} className="digit-in">
                {remaining === null ? "--" : String(value).padStart(2, "0")}
              </span>
            </span>
            <span className="text-xs uppercase tracking-widest text-muted">{label}</span>
          </div>
        ))}
      </div>
      <p className="min-h-6 text-muted">
        {remaining !== null && <time dateTime={unlockAt}>{m.gift.opensAt(formatLocal(unlockAt))}</time>}
      </p>
    </div>
  );
}

// -------------------------------------------------------------------- Wraps

function GiftBox({ open, onOpen }: { open: boolean; onOpen: () => void }) {
  return (
    <button
      type="button"
      className={`giftbox ${open ? "is-open" : ""}`}
      onClick={onOpen}
      disabled={open}
      aria-label={m.gift.boxLabel}
    >
      <GiftBoxArt withEffects />
    </button>
  );
}

/**
 * Confetti drawn on one full-screen canvas. Each change of `burst` throws a
 * fresh handful up from the wrap, then lets it fall with gravity and drift.
 */
function ConfettiCanvas({ burst, wrapStyle }: { burst: number; wrapStyle: WrapStyle }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!burst || !canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = window.innerWidth;
    const height = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const wrap = document.querySelector(".giftbox, .envelope")?.getBoundingClientRect();
    const originX = wrap ? wrap.left + wrap.width / 2 : width / 2;
    const originY = wrap ? wrap.top + wrap.height * 0.42 : height / 2;

    const { colors, count } = CONFETTI[wrapStyle];
    const pieces = Array.from({ length: count }, (_, i) => {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.95;
      const speed = 8 + Math.random() * 13;
      return {
        x: originX,
        y: originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 6 + Math.random() * 7,
        rotation: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 0.4,
        flutter: Math.random() * Math.PI * 2,
        round: i % 5 === 0,
        color: colors[i % colors.length],
      };
    });

    const LIFE_MS = 3400;
    const FADE_MS = 900;
    let frame = 0;
    let start = 0;
    let last = 0;

    const draw = (time: number) => {
      if (!start) start = last = time;
      const elapsed = time - start;
      // Steps are scaled to the real frame time, so slow phones get the same motion.
      const step = Math.min((time - last) / 16.67, 3);
      last = time;
      ctx.clearRect(0, 0, width, height);
      if (elapsed > LIFE_MS) return;
      ctx.globalAlpha = Math.min(1, (LIFE_MS - elapsed) / FADE_MS);

      const drag = Math.pow(0.985, step);
      for (const piece of pieces) {
        piece.vy += 0.42 * step;
        piece.vx *= drag;
        piece.vy *= drag;
        piece.x += piece.vx * step;
        piece.y += piece.vy * step;
        piece.rotation += piece.spin * step;
        piece.flutter += 0.18 * step;

        ctx.save();
        ctx.translate(piece.x, piece.y);
        ctx.rotate(piece.rotation);
        ctx.scale(1, Math.cos(piece.flutter));
        ctx.fillStyle = piece.color;
        if (piece.round) {
          ctx.beginPath();
          ctx.arc(0, 0, piece.size / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(-piece.size / 2, -piece.size * 0.7, piece.size, piece.size * 1.4);
        }
        ctx.restore();
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frame);
      ctx.clearRect(0, 0, width, height);
    };
  }, [burst, wrapStyle]);

  return <canvas ref={ref} className="confetti-canvas" aria-hidden="true" />;
}

function Envelope({ open, onOpen, receiverName }: { open: boolean; onOpen: () => void; receiverName: string }) {
  return (
    <div className={`envelope ${open ? "is-open" : ""}`}>
      <div className="envelope-back" />
      <div className="envelope-card">{m.gift.cardFor(receiverName)}</div>
      <div className="envelope-front" />
      <div className="envelope-flap" />
      <button
        type="button"
        className="envelope-seal"
        onClick={onOpen}
        disabled={open}
        aria-label={m.gift.sealLabel}
      >
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
        </svg>
      </button>
    </div>
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
  const [burst, setBurst] = useState(0);
  // How far the server's clock is ahead of this phone's, in ms. Measured once the page is live.
  const [skew, setSkew] = useState<number | null>(null);
  useEffect(() => {
    setSkew(serverNow - Date.now());
  }, [serverNow]);

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

  async function unwrap() {
    if (stage !== "wrapped") return;
    setFailed(false);
    setStage("opening");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // A short buzz on phones that support it. Ignored everywhere else.
    if ("vibrate" in navigator) navigator.vibrate(30);
    if (!reducedMotion) setTimeout(() => setBurst((n) => n + 1), CONFETTI_DELAY_MS[wrapStyle]);
    try {
      // The gift's contents are fetched while the animation plays.
      const [result] = await Promise.all([
        revealGiftAction(id, answer),
        wait(reducedMotion ? 400 : OPEN_ANIMATION_MS),
      ]);
      if (result.status === "ok") {
        setGift(result.gift);
        setStage("revealed");
      } else if (result.status === "locked") {
        // The server says it is too early, so trust its clock and go back to waiting.
        setSkew(result.serverNow - Date.now());
        setStage("locked");
      } else if (result.status === "wrong_answer") {
        setWrongAnswer(true);
        setStage("question");
      } else {
        setFailed(true);
        setStage("wrapped");
      }
    } catch {
      setFailed(true);
      setStage("wrapped");
    }
  }

  const errorLine = failed && (
    <p role="alert" className="font-bold text-danger">
      {m.gift.error}
    </p>
  );

  let content;

  if (stage === "locked" && unlockAt) {
    content = (
      <section className="fade-in flex w-full flex-col items-center gap-8 text-center">
        <div className="flex flex-col gap-3">
          <h1 className="text-4xl font-extrabold">{m.gift.lockedHeading(senderName)}</h1>
          <p className="text-lg text-muted">{m.gift.lockedBody}</p>
        </div>
        <Countdown unlockAt={unlockAt} skew={skew} onDone={() => setStage(afterLock)} />
      </section>
    );
  } else if (stage === "question" && secretQuestion) {
    content = (
      <form onSubmit={submitAnswer} className="fade-in flex w-full flex-col gap-6">
        <div className="flex flex-col gap-4 text-center">
          <p className="text-muted">{m.gift.questionHeading(senderName)}</p>
          <h1 className="text-3xl font-extrabold">{secretQuestion}</h1>
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="answer" className="font-bold">
            {m.gift.answerLabel}
          </label>
          <input
            id="answer"
            className="input"
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
            <p id="answer-error" role="alert" className="text-sm font-bold text-danger">
              {m.gift.answerWrong}
            </p>
          )}
        </div>
        {errorLine}
        <button type="submit" className="btn btn-primary" disabled={checking || !answer.trim()}>
          {checking ? m.gift.answerChecking : m.gift.answerSubmit}
        </button>
      </form>
    );
  } else if (stage === "revealed" && gift) {
    let host = "";
    try {
      host = new URL(gift.url).hostname.replace(/^www\./, "");
    } catch {
      // Stored URLs are validated on creation, so this should not happen.
    }
    content = (
      <section className="flex w-full flex-col gap-6">
        <h1 className="fade-in text-center text-3xl font-extrabold">{m.gift.revealHeading(senderName)}</h1>

        {gift.note && (
          <figure className="rise panel flex flex-col gap-3">
            <blockquote className="whitespace-pre-wrap text-lg leading-relaxed">{gift.note}</blockquote>
            <figcaption className="text-sm font-bold text-muted">{m.gift.noteFrom(senderName)}</figcaption>
          </figure>
        )}

        <div className="rise panel overflow-hidden p-0" style={{ animationDelay: "0.14s" }}>
          {gift.ogImage && (
            // The image lives on someone else's server, so next/image is not used here.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={gift.ogImage}
              alt=""
              referrerPolicy="no-referrer"
              className="aspect-[1.91/1] w-full object-cover"
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
            />
          )}
          <div className="flex flex-col gap-1 p-4">
            <p className="line-clamp-2 font-bold">{gift.ogTitle || host}</p>
            <p className="text-sm text-muted">{host}</p>
          </div>
        </div>

        <a
          href={gift.url}
          target="_blank"
          rel="noopener noreferrer"
          className="rise btn btn-primary text-lg"
          style={{ animationDelay: "0.28s" }}
        >
          {m.gift.open}
        </a>

        <div
          className="fade-in mt-6 flex flex-col items-center gap-4 border-t border-line pt-8"
          style={{ animationDelay: "0.6s" }}
        >
          <Link href="/create" className="btn btn-secondary w-full">
            {m.gift.makeOne}
          </Link>
          <p className="text-sm text-muted">{m.gift.wrappedWith}</p>
        </div>
      </section>
    );
  } else {
    const open = stage === "opening";
    content = (
      <section className="flex w-full flex-col items-center gap-10 text-center">
        <div className="flex flex-col gap-3">
          <h1 className="text-4xl font-extrabold">{m.gift.wrappedHeading(receiverName)}</h1>
          <p className="text-lg text-muted">{m.gift.wrappedFrom(senderName)}</p>
        </div>
        {wrapStyle === "envelope" ? (
          <Envelope open={open} onOpen={unwrap} receiverName={receiverName} />
        ) : (
          <GiftBox open={open} onOpen={unwrap} />
        )}
        <p className="tap-hint min-h-6 font-bold text-accent" style={{ visibility: open ? "hidden" : "visible" }}>
          {wrapStyle === "envelope" ? m.gift.tapSeal : m.gift.tapBox}
        </p>
        {errorLine}
      </section>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-[430px] flex-col items-center justify-center overflow-x-clip px-5 py-10">
      {content}
      <ConfettiCanvas burst={burst} wrapStyle={wrapStyle} />
    </main>
  );
}
