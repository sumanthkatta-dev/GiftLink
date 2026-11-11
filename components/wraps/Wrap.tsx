"use client";

import { CardWrap } from "./CardWrap";
import { EnvelopeWrap } from "./EnvelopeWrap";
import type { AnyWrapProps } from "./shared";
import { TicketWrap } from "./TicketWrap";

export type { WrapSize, WrapState } from "./shared";

export function Wrap({ kind, ...props }: AnyWrapProps) {
  if (kind === "envelope") return <EnvelopeWrap {...props} />;
  if (kind === "ticket") return <TicketWrap {...props} />;
  return <CardWrap {...props} />;
}
