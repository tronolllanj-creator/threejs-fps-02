// TIDELOCK HARBOR - Palette single source of truth for colours in JS and CSS.

export const PALETTE = {
    canvas: '#0f141b',
    surface: '#1d2530',
    hairline: '#2e3a47',
    ink: '#e8e4d8',
    muted: '#8fa3b0',
    accent: '#f2a541',
  accentSoft: '#f7c06a',
    azure: '#37c8d9',
    ember: '#e05a4e',
    gold: '#f0c040'
};

export function shade(name) {
    return PALETTE[name] || PALETTE.canvas;
}
