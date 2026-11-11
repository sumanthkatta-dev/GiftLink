import Link from "next/link";
import { SiteHeader } from "@/components/Brand";
import { LandingDemo } from "@/components/LandingDemo";
import { m } from "@/lib/messages";

export default function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <main className="mx-auto grid w-full max-w-[1040px] flex-1 items-center gap-8 px-5 py-8 sm:px-6 lg:grid-cols-[1fr_1fr] lg:gap-16 lg:py-16">
        <div className="arrive lg:order-2" style={{ ["--d" as string]: "60ms" }}>
          <LandingDemo />
        </div>

        <div className="flex flex-col items-center gap-6 text-center lg:order-1 lg:items-start lg:text-left">
          <h1 className="arrive text-[40px] font-semibold leading-[1.04] tracking-[-0.035em] sm:text-[54px]">
            {m.landing.pitch}
          </h1>
          <p className="arrive max-w-[26rem] text-[18px] leading-relaxed text-fg-muted" style={{ ["--d" as string]: "90ms" }}>
            {m.landing.sub}
          </p>
          <Link
            href="/create"
            className="arrive ui-button ui-button-primary mt-2 w-full max-w-xs text-[16px] sm:w-auto sm:px-8"
            style={{ ["--d" as string]: "180ms" }}
          >
            {m.landing.cta}
          </Link>
        </div>
      </main>

      <section className="mx-auto w-full max-w-[1040px] px-5 pb-16 sm:px-6">
        <ol className="grid gap-8 border-t border-line pt-10 sm:grid-cols-3">
          {m.landing.steps.map((step, index) => (
            <li key={step.title} className="arrive flex gap-4 sm:flex-col sm:gap-3" style={{ ["--d" as string]: `${260 + index * 80}ms` }}>
              <span aria-hidden="true" className="font-serif text-[28px] leading-none text-fg-muted">
                {index + 1}
              </span>
              <div className="flex flex-col gap-1">
                <h2 className="text-[16px] font-medium">{step.title}</h2>
                <p className="text-[15px] leading-relaxed text-fg-muted">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
