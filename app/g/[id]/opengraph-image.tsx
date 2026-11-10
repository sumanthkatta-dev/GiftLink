import { ImageResponse } from "next/og";
import { m } from "@/lib/messages";

export const alt = m.meta.giftImageAlt;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The same picture for every gift: it shows a wrapped box and nothing about the contents.
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
          background: "#1A1433",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              width: 380,
              height: 84,
              borderRadius: 16,
              background: "#FF7DA5",
            }}
          >
            <div style={{ width: 64, height: 84, background: "#F7B32B" }} />
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              width: 330,
              height: 230,
              borderRadius: "0 0 22px 22px",
              background: "#FF5D8F",
            }}
          >
            <div style={{ width: 64, height: 230, background: "#F7B32B" }} />
          </div>
        </div>
      </div>
    ),
    size,
  );
}
