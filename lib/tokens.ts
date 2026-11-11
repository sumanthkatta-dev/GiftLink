/**
 * The few colours needed outside CSS: the browser's theme colour and the
 * generated link-preview image, which can't read CSS variables.
 * Keep these equal to the matching variables in app/globals.css.
 */
export const tokens = {
  canvas: "#0b0b0d",
  ivory: "#f6f1e6",
  ivoryEdge: "#d3c7ae",
  gold: "#c9a45c",
  goldLight: "#e9d29a",
  goldDark: "#8e6f33",
} as const;
