import { EmptyState } from "@/components/EmptyState";
import { IconCompass } from "@/components/icons";
import { m } from "@/lib/messages";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-5 py-16">
      <EmptyState
        icon={<IconCompass className="size-6" />}
        heading={m.notFound.heading}
        body={m.notFound.body}
        action={{ href: "/", label: m.notFound.cta }}
      />
    </main>
  );
}
