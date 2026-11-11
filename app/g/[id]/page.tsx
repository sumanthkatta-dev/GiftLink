import type { Metadata } from "next";
import { Suspense } from "react";
import { EmptyState } from "@/components/EmptyState";
import { GiftExperience } from "@/components/GiftExperience";
import { IconGift } from "@/components/icons";
import { m } from "@/lib/messages";
import { getGift } from "@/lib/store";

type Props = PageProps<"/g/[id]">;

// Link previews (WhatsApp and others) read these tags.
// They name the sender and nothing else: no wrapped URL, title, or note.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const gift = await getGift(id);
  const title = gift ? m.meta.giftTitle(gift.senderName) : m.meta.giftFallbackTitle;
  const description = m.meta.giftDescription;
  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: { title, description, type: "website", siteName: m.brand, url: `/g/${id}` },
    twitter: { card: "summary_large_image", title, description },
  };
}

async function Gift({ params }: Pick<Props, "params">) {
  const { id } = await params;
  const gift = await getGift(id);

  if (!gift) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-5 py-16">
        <EmptyState
          icon={<IconGift className="size-6" />}
          heading={m.gift.notFoundHeading}
          body={m.gift.notFoundBody}
          action={{ href: "/create", label: m.gift.notFoundCta }}
        />
      </main>
    );
  }

  // Only what the wrapped screens need is sent to the browser.
  // The URL, note and preview come later, from revealGiftAction.
  return (
    <GiftExperience
      id={gift.id}
      senderName={gift.senderName}
      receiverName={gift.receiverName}
      wrapStyle={gift.wrapStyle}
      unlockAt={gift.unlockAt}
      secretQuestion={gift.secretQuestion}
      lockedAtRender={gift.unlockAt ? Date.parse(gift.unlockAt) > Date.now() : false}
      serverNow={Date.now()}
    />
  );
}

export default function GiftPage({ params }: Props) {
  return (
    <Suspense fallback={<div className="min-h-dvh" />}>
      <Gift params={params} />
    </Suspense>
  );
}
