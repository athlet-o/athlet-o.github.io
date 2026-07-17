export function mix(hex: string, other: string, weight: number): string {
  const parse = (h: string) =>
    h
      .replace("#", "")
      .match(/../g)!
      .map((c) => parseInt(c, 16));
  const [r1, g1, b1] = parse(hex);
  const [r2, g2, b2] = parse(other);
  const channel = (a: number, b: number) => Math.round(a + (b - a) * weight);
  return `#${[channel(r1, r2), channel(g1, g2), channel(b1, b2)]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("")}`;
}

export const lighten = (hex: string, weight: number) => mix(hex, "#ffffff", weight);

// Shade toward the site ink color so shadows stay on-brand instead of going gray.
export const darken = (hex: string, weight: number) => mix(hex, "#0c2228", weight);
