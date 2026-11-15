// The PALETTE is the single source of truth for colours in JS and CSS for EMBER CANYON.

export const PALETTE = {
    canvas: '#f0c078',
    surface: '#8a6a42',
    hairline: '#4a3a26',
    ink: '#f2e8d5',
    muted: '#b8a88e',
    accent: '#f7b731',
    teal: '#3ec6c0',
    crimson: '#e04e3a',
    gold: '#f0c040'
};

export function shade(name) {
  // Unknown names fall back to ink so a typo never renders black.
    return PALETTE[name] || PALETTE.ink;
}
