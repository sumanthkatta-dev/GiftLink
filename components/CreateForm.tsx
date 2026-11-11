"use client";

import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import {
  createGiftAction,
  type CreateErrors,
  type CreateField,
  type CreateGiftInput,
} from "@/app/actions";
import { CopyLink } from "@/components/CopyLink";
import { IconCheck, IconLock } from "@/components/icons";
import { UnlockPicker } from "@/components/UnlockPicker";
import { Wrap } from "@/components/wraps/Wrap";
import { LIMITS } from "@/lib/limits";
import { m } from "@/lib/messages";
import { DEFAULT_WRAP, normalizeWrap, WRAP_STYLES } from "@/lib/wraps";

const EMPTY: CreateGiftInput = {
  url: "",
  receiverName: "",
  senderName: "",
  note: "",
  wrapStyle: DEFAULT_WRAP,
  unlockAt: "",
  secretQuestion: "",
  secretAnswer: "",
};

const delay = (ms: number) => ({ ["--d" as string]: `${ms}ms` });

function Field({
  name,
  label,
  optional,
  hint,
  error,
  children,
}: {
  name: CreateField;
  label: string;
  optional?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={name} className="text-[14px] font-medium text-fg">
        {label}
        {optional && <span className="ms-2 font-normal text-fg-muted">{m.create.optional}</span>}
      </label>
      {children}
      {hint && !error && (
        <p id={`${name}-hint`} className="text-[13px] text-fg-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${name}-error`} role="alert" className="text-[13px] font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

function Group({ id, title, hint, children, i }: { id: string; title: string; hint?: string; children: ReactNode; i: number }) {
  return (
    <section aria-labelledby={id} className="arrive flex flex-col gap-5" style={delay(80 + i * 60)}>
      <div className="flex flex-col gap-1 border-b border-line pb-3">
        <h2 id={id} className="text-[17px] font-semibold">
          {title}
        </h2>
        {hint && <p className="text-[14px] text-fg-muted">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

export function CreateForm() {
  // `unlockAt` holds a local "YYYY-MM-DDTHH:mm" value from UnlockPicker; it becomes UTC on submit.
  const [values, setValues] = useState<CreateGiftInput>(EMPTY);
  const [errors, setErrors] = useState<CreateErrors>({});
  const [result, setResult] = useState<{ id: string; key: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [writingNote, setWritingNote] = useState(false);
  const [showInside, setShowInside] = useState(false);

  const wrap = normalizeWrap(values.wrapStyle);
  const previewOpen = showInside || writingNote;
  const receiver = values.receiverName.trim() || m.create.previewReceiver;
  const sender = values.senderName.trim() || m.create.previewSender;

  function set(field: keyof CreateGiftInput, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function errorFor(field: CreateField): string | undefined {
    const key = errors[field];
    return key ? m.errors[key] : undefined;
  }

  function inputProps(field: keyof CreateGiftInput) {
    return {
      id: field,
      name: field,
      className: "ui-input",
      value: values[field],
      "aria-invalid": errors[field] ? true : undefined,
      "aria-describedby": errors[field] ? `${field}-error` : `${field}-hint`,
    };
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();

    // The picker gives local wall-clock time. Convert to UTC before it leaves the browser.
    let unlockAt = "";
    if (values.unlockAt) {
      const local = new Date(values.unlockAt);
      if (Number.isNaN(local.getTime())) {
        setErrors({ unlockAt: "dateInvalid" });
        return;
      }
      unlockAt = local.toISOString();
    }

    startTransition(async () => {
      try {
        const response = await createGiftAction({ ...values, unlockAt });
        if (response.ok) {
          setErrors({});
          setResult({ id: response.id, key: response.key });
          window.scrollTo({ top: 0 });
        } else {
          setErrors(response.errors);
        }
      } catch {
        setErrors({ form: "generic" });
      }
    });
  }

  const preview = (size: "preview" | "small", open: boolean) => (
    <Wrap
      kind={wrap}
      size={size}
      state={open ? "open" : "closed"}
      idle
      receiverName={receiver}
      senderName={sender}
      note={values.note.trim() ? values.note : null}
      notePlaceholder={m.create.previewNote}
      seed="preview"
    />
  );

  if (result) {
    const managePath = `/m/${result.id}?key=${result.key}`;
    return (
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-14">
        <section className="flex max-w-xl flex-col gap-5">
          <div className="arrive mb-3 flex flex-col gap-4">
            <span className="pop-in grid size-12 place-items-center rounded-full bg-accent text-accent-ink" style={delay(120)}>
              <IconCheck className="size-6" />
            </span>
            <h1 className="text-[34px] font-semibold leading-tight tracking-[-0.03em]">{m.created.heading}</h1>
            <p className="text-[16px] leading-relaxed text-fg-muted">{m.created.lead(values.receiverName.trim())}</p>
          </div>
          <div className="arrive ui-card p-5" style={delay(120)}>
            <CopyLink label={m.created.shareLabel} hint={m.created.shareHint} path={`/g/${result.id}`} />
          </div>
          <div className="arrive ui-card p-5" style={delay(200)}>
            <CopyLink
              label={m.created.manageLabel}
              hint={m.created.manageHint}
              path={managePath}
              hintIcon={<IconLock className="mt-px size-4 shrink-0" />}
            />
          </div>
          <div className="arrive mt-2 flex flex-col gap-2 sm:flex-row" style={delay(280)}>
            <a href={managePath} className="ui-button ui-button-secondary sm:flex-1">
              {m.created.openManage}
            </a>
            <button
              type="button"
              className="ui-button ui-button-quiet sm:flex-1"
              onClick={() => {
                setResult(null);
                setValues(EMPTY);
                setShowInside(false);
              }}
            >
              {m.created.another}
            </button>
          </div>
        </section>
        <aside className="arrive hidden lg:block" style={delay(160)} aria-hidden="true">
          <div className="ui-card stage-light preview-stage grid place-items-center">{preview("preview", false)}</div>
        </aside>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="arrive flex max-w-xl flex-col gap-2">
        <h1 className="text-[34px] font-semibold leading-tight tracking-[-0.03em]">{m.create.heading}</h1>
        <p className="text-[16px] text-fg-muted">{m.create.intro}</p>
      </header>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-14">
        <aside className="arrive lg:order-2" style={delay(60)}>
          <div className="ui-card overflow-hidden lg:sticky lg:top-6">
            <div className="flex items-center justify-between gap-3 border-b border-line py-2 pl-4 pr-2">
              <span className="text-[13px] font-medium text-fg-muted">{m.create.preview}</span>
              <button
                type="button"
                className="ui-button ui-button-sm ui-button-quiet"
                aria-pressed={showInside}
                onClick={() => setShowInside((v) => !v)}
              >
                {previewOpen ? m.create.previewOutside : m.create.previewInside}
              </button>
            </div>
            <div className="stage-light preview-stage grid place-items-center" aria-hidden="true">
              {preview("preview", previewOpen)}
            </div>
          </div>
        </aside>

        <form onSubmit={onSubmit} noValidate className="flex min-w-0 max-w-xl flex-col gap-12 lg:order-1">
          <Group id="g-gift" title={m.create.sectionGift} i={0}>
            <Field name="url" label={m.create.url} hint={m.create.urlHint} error={errorFor("url")}>
              <input
                {...inputProps("url")}
                type="url"
                inputMode="url"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                placeholder={m.create.urlPlaceholder}
                maxLength={LIMITS.url}
                onChange={(event) => set("url", event.target.value)}
              />
            </Field>
          </Group>

          <Group id="g-people" title={m.create.sectionPeople} i={1}>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field name="receiverName" label={m.create.receiverName} error={errorFor("receiverName")}>
                <input
                  {...inputProps("receiverName")}
                  autoComplete="off"
                  maxLength={LIMITS.name}
                  onChange={(event) => set("receiverName", event.target.value)}
                />
              </Field>
              <Field name="senderName" label={m.create.senderName} error={errorFor("senderName")}>
                <input
                  {...inputProps("senderName")}
                  autoComplete="given-name"
                  maxLength={LIMITS.name}
                  onChange={(event) => set("senderName", event.target.value)}
                />
              </Field>
            </div>
            <Field name="note" label={m.create.note} optional hint={m.create.noteHint} error={errorFor("note")}>
              <textarea
                {...inputProps("note")}
                rows={3}
                maxLength={LIMITS.note}
                onFocus={() => setWritingNote(true)}
                onBlur={() => setWritingNote(false)}
                onChange={(event) => set("note", event.target.value)}
              />
            </Field>
          </Group>

          <section className="arrive flex flex-col gap-5" style={delay(200)}>
            <fieldset className="flex flex-col gap-5">
              <legend className="mb-5 w-full border-b border-line pb-3 text-[17px] font-semibold">{m.create.sectionWrap}</legend>
              <div className="grid grid-cols-3 gap-2.5">
                {WRAP_STYLES.map((kind) => (
                  <label
                    key={kind}
                    className="group relative flex cursor-pointer flex-col items-center gap-1 rounded-card border border-line bg-canvas px-1.5 pb-3 pt-2 text-center transition-[border-color,background-color,transform] duration-300 ease-spring hover:border-line-strong active:scale-[0.98] has-checked:border-accent has-checked:bg-surface has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent"
                  >
                    <input
                      type="radio"
                      name="wrapStyle"
                      value={kind}
                      checked={wrap === kind}
                      onChange={() => set("wrapStyle", kind)}
                      className="sr-only"
                    />
                    <span className="grid h-[116px] place-items-center" aria-hidden="true">
                      <Wrap kind={kind} size="mini" state="closed" receiverName={receiver} senderName={sender} note={null} />
                    </span>
                    <span className="text-[14px] font-medium text-fg">{m.create.wraps[kind].label}</span>
                    <span className="text-[12px] leading-snug text-fg-muted">{m.create.wraps[kind].hint}</span>
                    <span
                      aria-hidden="true"
                      className="absolute right-2 top-2 grid size-5 scale-50 place-items-center rounded-full bg-accent text-accent-ink opacity-0 transition-[opacity,transform] duration-300 ease-spring group-has-checked:scale-100 group-has-checked:opacity-100"
                    >
                      <IconCheck className="size-3.5" />
                    </span>
                  </label>
                ))}
              </div>
              {errors.wrapStyle && (
                <p role="alert" className="text-[13px] font-medium text-danger">
                  {m.errors[errors.wrapStyle]}
                </p>
              )}
            </fieldset>
          </section>

          <Group id="g-extras" title={m.create.sectionExtras} hint={m.create.extrasHint} i={3}>
            <UnlockPicker
              errorId="unlockAt-error"
              error={errorFor("unlockAt")}
              onChange={(value) => set("unlockAt", value)}
            />
            <Field
              name="secretQuestion"
              label={m.create.secretQuestion}
              optional
              hint={m.create.secretHint}
              error={errorFor("secretQuestion")}
            >
              <input
                {...inputProps("secretQuestion")}
                autoComplete="off"
                placeholder={m.create.secretQuestionPlaceholder}
                maxLength={LIMITS.question}
                onChange={(event) => set("secretQuestion", event.target.value)}
              />
            </Field>
            <Field name="secretAnswer" label={m.create.secretAnswer} optional error={errorFor("secretAnswer")}>
              <input
                {...inputProps("secretAnswer")}
                autoComplete="off"
                maxLength={LIMITS.answer}
                onChange={(event) => set("secretAnswer", event.target.value)}
              />
            </Field>
          </Group>

          <div className="arrive flex flex-col gap-3" style={delay(320)}>
            {errors.form && (
              <p role="alert" className="text-[14px] font-medium text-danger">
                {m.errors[errors.form]}
              </p>
            )}
            <button type="submit" className="ui-button ui-button-primary w-full text-[16px]" disabled={pending}>
              {pending ? m.create.submitting : m.create.submit}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
