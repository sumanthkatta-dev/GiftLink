"use client";

import Link from "next/link";
import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import {
  createGiftAction,
  type CreateErrors,
  type CreateField,
  type CreateGiftInput,
} from "@/app/actions";
import { CopyLink } from "@/components/CopyLink";
import { LIMITS } from "@/lib/limits";
import { m } from "@/lib/messages";

const EMPTY: CreateGiftInput = {
  url: "",
  receiverName: "",
  senderName: "",
  note: "",
  wrapStyle: "box",
  unlockAt: "",
  secretQuestion: "",
  secretAnswer: "",
};

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
      <label htmlFor={name} className="font-bold">
        {label}
        {optional && <span className="ms-2 text-sm font-normal text-muted">{m.create.optional}</span>}
      </label>
      {children}
      {hint && !error && (
        <p id={`${name}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${name}-error`} role="alert" className="text-sm font-bold text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function CreateForm() {
  // `unlockAt` holds the raw datetime-local value here; it becomes UTC on submit.
  const [values, setValues] = useState<CreateGiftInput>(EMPTY);
  const [errors, setErrors] = useState<CreateErrors>({});
  const [result, setResult] = useState<{ id: string; key: string } | null>(null);
  const [pending, startTransition] = useTransition();

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
      className: "input",
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
        } else {
          setErrors(response.errors);
        }
      } catch {
        setErrors({ form: "generic" });
      }
    });
  }

  if (result) {
    return (
      <section className="fade-in flex flex-col gap-7">
        <h1 className="text-4xl font-extrabold">{m.created.heading}</h1>
        <CopyLink label={m.created.shareLabel} hint={m.created.shareHint} path={`/g/${result.id}`} />
        <CopyLink
          label={m.created.manageLabel}
          hint={m.created.manageHint}
          path={`/m/${result.id}?key=${result.key}`}
        />
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            setResult(null);
            setValues(EMPTY);
          }}
        >
          {m.created.another}
        </button>
      </section>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <Link href="/" className="text-sm font-bold uppercase tracking-[0.2em] text-accent">
          {m.brand}
        </Link>
        <h1 className="text-4xl font-extrabold">{m.create.heading}</h1>
        <p className="text-muted">{m.create.intro}</p>
      </header>

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

      <Field name="note" label={m.create.note} optional hint={m.create.noteHint} error={errorFor("note")}>
        <textarea
          {...inputProps("note")}
          rows={3}
          maxLength={LIMITS.note}
          onChange={(event) => set("note", event.target.value)}
        />
      </Field>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-bold">{m.create.wrapStyle}</legend>
        <div className="grid grid-cols-2 gap-3">
          {(
            [
              ["box", m.create.wrapBox, m.create.wrapBoxHint],
              ["envelope", m.create.wrapEnvelope, m.create.wrapEnvelopeHint],
            ] as const
          ).map(([value, label, hint]) => (
            <label
              key={value}
              className="panel flex min-h-[72px] cursor-pointer flex-col gap-1 has-checked:border-accent has-focus-visible:outline-2 has-focus-visible:outline-accent"
            >
              <input
                type="radio"
                name="wrapStyle"
                value={value}
                checked={values.wrapStyle === value}
                onChange={() => set("wrapStyle", value)}
                className="sr-only"
              />
              <span className="font-bold">{label}</span>
              <span className="text-sm text-muted">{hint}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <Field
        name="unlockAt"
        label={m.create.unlockAt}
        optional
        hint={m.create.unlockHint}
        error={errorFor("unlockAt")}
      >
        <input
          {...inputProps("unlockAt")}
          type="datetime-local"
          onChange={(event) => set("unlockAt", event.target.value)}
        />
      </Field>

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

      {errors.form && (
        <p role="alert" className="font-bold text-danger">
          {m.errors[errors.form]}
        </p>
      )}

      <button type="submit" className="btn btn-primary text-lg" disabled={pending}>
        {pending ? m.create.submitting : m.create.submit}
      </button>
    </form>
  );
}
