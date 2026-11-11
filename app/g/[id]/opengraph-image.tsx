import { ImageResponse } from "next/og";
import { m } from "@/lib/messages";
import { tokens } from "@/lib/tokens";

export const alt = m.meta.giftImageAlt;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const foil = `linear-gradient(135deg, ${tokens.goldDark}, ${tokens.goldLight} 30%, ${tokens.gold} 50%, ${tokens.goldLight} 70%, ${tokens.goldDark})`;

// The same picture for every gift: a closed ivory card, and nothing about what's inside.
export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: tokens.canvas,
        }}
      >
        <div
          style={{
            display: "flex",
            width: 330,
            height: 462,
            padding: 22,
            borderRadius: 12,
            background: tokens.ivory,
            transform: "rotate(-4deg)",
            boxShadow: `0 4px 0 ${tokens.ivoryEdge}, 0 40px 80px rgba(0, 0, 0, 0.55)`,
          }}
        >
          <div style={{ display: "flex", flex: 1, padding: 2, background: foil }}>
            <div
              style={{
                display: "flex",
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                background: tokens.ivory,
              }}
            >
              <div style={{ display: "flex", width: 90, height: 2, background: foil }} />
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
