// Inline line icons. Geometric, 1.5px stroke, currentColor — no icon font, no
// sprite sheet, nothing to download.

const wrap = (paths, size = 18) =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

export const icons = {
  terminal: (s) => wrap('<path d="M4 6h16v12H4z"/><path d="M7.5 10l2 2-2 2"/><path d="M12.5 14.5h4"/>', s),
  globe: (s) => wrap('<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17"/><path d="M12 3.5c2.2 2.3 3.4 5.3 3.4 8.5S14.2 18.2 12 20.5c-2.2-2.3-3.4-5.3-3.4-8.5S9.8 5.8 12 3.5z"/>', s),
  layers: (s) => wrap('<path d="M12 3.5l8 4.2-8 4.2-8-4.2 8-4.2z"/><path d="M4 12.2l8 4.2 8-4.2"/><path d="M4 16.3l8 4.2 8-4.2"/>', s),
  chart: (s) => wrap('<path d="M4 19V5"/><path d="M4 19h16"/><path d="M7.5 15.5l3.5-4 3 2.5 4.5-6"/>', s),
  database: (s) => wrap('<ellipse cx="12" cy="6" rx="7.5" ry="3"/><path d="M4.5 6v12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V6"/><path d="M4.5 12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3"/>', s),
  server: (s) => wrap('<rect x="3.5" y="4" width="17" height="6" rx="1.5"/><rect x="3.5" y="14" width="17" height="6" rx="1.5"/><path d="M7 7h.01M7 17h.01"/>', s),
  shield: (s) => wrap('<path d="M12 3l7 3v5.5c0 4.3-2.9 8-7 9.5-4.1-1.5-7-5.2-7-9.5V6l7-3z"/><path d="M9.2 12l2 2 3.6-4"/>', s),
  monitor: (s) => wrap('<rect x="3" y="4.5" width="18" height="12" rx="1.5"/><path d="M9 20h6"/><path d="M12 16.5V20"/>', s),
  package: (s) => wrap('<path d="M20.5 8.2v7.6a1.5 1.5 0 01-.8 1.3l-7 3.8a1.5 1.5 0 01-1.4 0l-7-3.8a1.5 1.5 0 01-.8-1.3V8.2"/><path d="M3.8 7.6l8.2 4.4 8.2-4.4-8.2-4.4-8.2 4.4z"/><path d="M12 12v8.9"/>', s),
  lock: (s) => wrap('<rect x="4.5" y="10.5" width="15" height="9.5" rx="1.5"/><path d="M8 10.5V7.8a4 4 0 118 0v2.7"/>', s),
  filter: (s) => wrap('<path d="M4 5h16l-6.3 7.4v5.9l-3.4 1.9v-7.8L4 5z"/>', s),
  power: (s) => wrap('<path d="M12 4v8"/><path d="M17.3 6.7a7.5 7.5 0 11-10.6 0"/>', s),
  windows: (s = 20) =>
    `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="currentColor" aria-hidden="true"><path d="M3 5.6l7.3-1v7.1H3V5.6zm0 12.8l7.3 1v-7h-7.3v6zM11.3 4.4L21 3v8.7h-9.7V4.4zm0 8.3H21V21l-9.7-1.4v-6.9z"/></svg>`,
  check: (s = 14) => wrap('<path d="M4.5 12.5l4.5 4.5 10-11"/>', s),
  arrowDown: (s = 16) => wrap('<path d="M12 4.5v15"/><path d="M6 13.5l6 6 6-6"/>', s),
  arrowRight: (s = 16) => wrap('<path d="M4.5 12h15"/><path d="M13.5 6l6 6-6 6"/>', s),
  copy: (s = 13) => wrap('<rect x="9" y="9" width="11" height="11" rx="1.5"/><path d="M5.5 15H5a1 1 0 01-1-1V5a1 1 0 011-1h9a1 1 0 011 1v.5"/>', s),
  github: (s = 16) =>
    `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 00-3.16 19.49c.5.09.68-.22.68-.48l-.01-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.89 1.53 2.34 1.09 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.56-1.11-4.56-4.95 0-1.09.39-1.99 1.03-2.69-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.03a9.5 9.5 0 015 0c1.91-1.3 2.75-1.03 2.75-1.03.55 1.38.2 2.4.1 2.65.64.7 1.03 1.6 1.03 2.69 0 3.85-2.34 4.7-4.57 4.95.36.31.68.92.68 1.85l-.01 2.75c0 .27.18.58.69.48A10 10 0 0012 2z"/></svg>`,
  alert: (s = 18) => wrap('<path d="M12 4l9 15.5H3L12 4z"/><path d="M12 10v4"/><path d="M12 17h.01"/>', s),
};

// The teal radar target from build/icon.png, redrawn as vector so it stays
// crisp at nav size and inherits no raster weight.
export function brandMark(size = 26) {
  return `<svg class="brand-mark" viewBox="0 0 32 32" width="${size}" height="${size}" aria-hidden="true">
  <rect width="32" height="32" rx="7" fill="#070b12"/>
  <circle cx="16" cy="16" r="11" fill="none" stroke="#2ee6a8" stroke-width="1.6" opacity=".85"/>
  <circle cx="16" cy="16" r="7.2" fill="none" stroke="#2b9ff5" stroke-width="1.6" opacity=".9"/>
  <circle cx="16" cy="16" r="3.6" fill="none" stroke="#2ee6a8" stroke-width="1.6" opacity=".7"/>
  <circle cx="16" cy="16" r="2" fill="#5ef0c4"/>
</svg>`;
}
