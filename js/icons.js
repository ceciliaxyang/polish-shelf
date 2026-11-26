/* Icons for the effect filter pills (Figma "Filters", node 2383:2326). Each is the inside of a 24x24
   SVG drawn in currentColor, so it turns white with the text when the pill is picked. Thermal, Solar and
   Glow-in-the-dark come from the reference; the rest follow the same 1.5px line style.
   Each is wrapped in <g class="ia ia-KEY"> and its moving parts carry classes, so the pill can play a short
   animation on hover (see "Pill icon animations" in css/style.css). Thermal is split into the glass and the
   mercury, Solar is redrawn as a ring and eight rays, and Glow-in-the-dark is drawn by moonPath
   (below) so it can wax to full and wane back. Parts in class "ia-x" only show while animating
   and are left out when the icon is sized (fitIcon). */
// Glow-in-the-dark's moon: a circle with a second, same-size circle (its shadow) cut out of it, offset by
// `off` toward the upper right. A small offset is a thin crescent; at 2R or more it's a full moon. The hover
// animation (js/app.js) slides the shadow away and back, so the moon waxes to full and wanes again.
const MOON_R = 10.1, MOON_REST = 8.2, MOON_UX = .866, MOON_UY = -.5;
function moonPath(off) {
  const R = MOON_R, f = n => (+n.toFixed(3)), ux = MOON_UX, uy = MOON_UY;
  if (off >= 2 * R - .01) return `M12 ${f(12 - R)}A${R} ${R} 0 1 0 12 ${f(12 + R)}A${R} ${R} 0 1 0 12 ${f(12 - R)}`;
  const h = Math.sqrt(R * R - off * off / 4), mx = 12 + ux * off / 2, my = 12 + uy * off / 2;
  const ax = mx - uy * h, ay = my + ux * h, bx = mx + uy * h, by = my - ux * h;
  return `M${f(ax)} ${f(ay)}A${R} ${R} 0 1 1 ${f(bx)} ${f(by)}A${R} ${R} 0 0 0 ${f(ax)} ${f(ay)}`;
}
const EFFECT_ICONS = {
  // From the Figma reference
  thermal: '<g class="ia ia-thermal"><path fill="currentColor" d="M12 0C14.0166 0 15.6614 1.59173 15.7465 3.58726L15.75 3.74992L15.7507 13.317L15.9461 13.4799C17.1246 14.5086 17.8656 15.9633 17.9834 17.5522L17.996 17.7801L18 18C18 21.3137 15.3137 24 12 24C8.68629 24 6 21.3137 6 18C6 16.2348 6.76856 14.598 8.06163 13.4731L8.24925 13.3162L8.25 3.75C8.25 1.78945 9.75453 0.180301 11.672 0.0141471L11.8373 0.00346463L12 0ZM12 1.5C10.8017 1.5 9.82225 2.43669 9.75382 3.61781L9.75 3.75002L9.74974 14.0825L9.42886 14.3063C8.2289 15.1434 7.5 16.5097 7.5 18C7.5 20.4853 9.51472 22.5 12 22.5C14.4853 22.5 16.5 20.4853 16.5 18C16.5 16.5748 15.8334 15.2629 14.7256 14.4189L14.5718 14.3068L14.251 14.0829L14.25 8.25H11.25V6.75H14.25V5.25H11.25V3.75H14.25C14.25 2.50736 13.2426 1.5 12 1.5Z"/><path fill="currentColor" d="M12.75 9.75L12.7506 15.0947C14.0442 15.4279 15 16.6023 15 18C15 19.6569 13.6569 21 12 21C10.3431 21 9 19.6569 9 18C9 16.6021 9.95617 15.4274 11.2502 15.0945L11.25 9.75H12.75ZM12 16.5C11.1716 16.5 10.5 17.1716 10.5 18C10.5 18.8284 11.1716 19.5 12 19.5C12.8284 19.5 13.5 18.8284 13.5 18C13.5 17.1716 12.8284 16.5 12 16.5Z"/><rect class="an merc" x="11.25" y="2.4" width="1.5" height="7.6" rx=".75" fill="currentColor"/><circle class="an bulb" cx="12" cy="18" r="1.6" fill="currentColor" opacity="0"/></g>',
  // From the Figma reference
  solar: '<g class="ia ia-solar" data-fit-nopad fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="6"/><path class="an r" style="--dx:1.30px;--dy:0.00px;--dl:0.00s" d="M18.60 12.00L23.25 12.00"/><path class="an r" style="--dx:0.92px;--dy:0.92px;--dl:0.04s" d="M16.67 16.67L20.17 20.17"/><path class="an r" style="--dx:0.00px;--dy:1.30px;--dl:0.08s" d="M12.00 18.60L12.00 23.25"/><path class="an r" style="--dx:-0.92px;--dy:0.92px;--dl:0.12s" d="M7.33 16.67L3.83 20.17"/><path class="an r" style="--dx:-1.30px;--dy:0.00px;--dl:0.16s" d="M5.40 12.00L0.75 12.00"/><path class="an r" style="--dx:-0.92px;--dy:-0.92px;--dl:0.20s" d="M7.33 7.33L3.83 3.83"/><path class="an r" style="--dx:-0.00px;--dy:-1.30px;--dl:0.24s" d="M12.00 5.40L12.00 0.75"/><path class="an r" style="--dx:0.92px;--dy:-0.92px;--dl:0.28s" d="M16.67 7.33L20.17 3.83"/></g>',
  // From the Figma reference
  glow: `<g class="ia ia-glow" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10.1" stroke="none"/><path class="moon" d="${moonPath(MOON_REST)}"/></g>`,
  // Horseshoe magnet
  magnetic: '<g class="ia ia-magnetic"><g class="an body"><g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M5.25 3.75h4.5V12a2.25 2.25 0 0 0 4.5 0V3.75h4.5V12a6.75 6.75 0 0 1-13.5 0z"/><path d="M5.25 7.5h4.5M14.25 7.5h4.5"/></g></g><g class="ia-x" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"><path class="an spk" opacity="0" d="M7.5 2.1v-1.6M5.1 2.4l-1-1M9.9 2.4l1-1"/><path class="an spk spk2" opacity="0" d="M16.5 2.1v-1.6M14.1 2.4l-1-1M18.9 2.4l1-1"/></g></g>',
  // Prism
  holo: '<g class="ia ia-holo" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M12 4.5 3.75 19.5h16.5z"/><g stroke-linecap="butt"><path class="an ray beam" pathLength="1" d="M.75 13.5h6"/><path class="an ray r1" pathLength="1" d="M16.5 11.25l6.75-3"/><path class="an ray r2" pathLength="1" d="M17.25 13.5h6"/><path class="an ray r3" pathLength="1" d="M18 15.75l5.25 3"/></g></g>',
  // Glitter
  shimmer: '<g class="ia ia-shimmer"><g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path class="an big" d="M9 3.75 10.5 9l5.25 1.5-5.25 1.5L9 17.25 7.5 12 2.25 10.5 7.5 9z"/></g><path class="an s1" fill="currentColor" d="M18 12.75l.9 2.85 2.85.9-2.85.9-.9 2.85-.9-2.85-2.85-.9 2.85-.9z"/><path class="an s2" fill="currentColor" d="M17.25 2.25l.6 1.9 1.9.6-1.9.6-.6 1.9-.6-1.9-1.9-.6 1.9-.6z"/><circle class="an dot" cx="5.25" cy="20.25" r="1.1" fill="currentColor"/></g>',
  // Overlapping circles
  multichrome: '<g class="ia ia-multichrome"><g class="an orbit" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><circle cx="8.6" cy="9" r="6"/><circle cx="15.4" cy="9" r="6"/><circle cx="12" cy="15" r="6"/></g></g>',
  // The Magnetic magnet, a little smaller, on a line (a topper goes over a base)
  magtopper: '<g class="ia ia-magtopper" fill="none" stroke="currentColor" stroke-linejoin="round"><g class="an mg"><g transform="translate(2.4 1.5) scale(.8)" stroke-width="1.875"><path d="M5.25 3.75h4.5V12a2.25 2.25 0 0 0 4.5 0V3.75h4.5V12a6.75 6.75 0 0 1-13.5 0z"/><path d="M5.25 7.5h4.5M14.25 7.5h4.5"/></g></g><path class="an ln" d="M5.25 20.25h13.5" stroke-width="1.5" stroke-linecap="round"/></g>',
  // Shards
  flakies: '<g class="ia ia-flakies" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path class="an sh1" d="M3 5.25 9.75 3l1.5 6-6.75 2.25z"/><path class="an sh2" d="M13.5 8.25l7.5 1.5-2.25 6.75-6-2.25z"/><path class="an sh3" d="M4.5 15.75l6-.75 1.5 6-6 .75z"/></g>',
  // Dust
  powder: '<g class="ia ia-powder" fill="currentColor"><circle class="an d" style="--dl:0s" cx="12" cy="12" r="1.6"/><circle class="an d" style="--dl:0.18s" cx="7" cy="9" r="1.2"/><circle class="an d" style="--dl:0.06s" cx="17" cy="9.5" r="1.2"/><circle class="an d" style="--dl:0.3s" cx="8.5" cy="16" r="1.2"/><circle class="an d" style="--dl:0.12s" cx="16" cy="15.5" r="1.2"/><circle class="an d" style="--dl:0.24s" cx="12" cy="5" r="1"/><circle class="an d" style="--dl:0.09s" cx="12" cy="19.5" r="1"/><circle class="an d" style="--dl:0.33s" cx="3.75" cy="13" r="0.85"/><circle class="an d" style="--dl:0.15s" cx="20.25" cy="12.75" r="0.85"/><circle class="an d" style="--dl:0.03s" cx="4.5" cy="5.25" r="0.75"/><circle class="an d" style="--dl:0.27s" cx="19.5" cy="4.5" r="0.75"/><circle class="an d" style="--dl:0.21s" cx="19.5" cy="20" r="0.75"/><circle class="an d" style="--dl:0.36s" cx="4.5" cy="19.75" r="0.75"/></g>',
  // Gumdrop
  jelly: '<g class="ia ia-jelly" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"><g class="an gum"><path d="M7.125 20.25h9.75a3.375 3.375 0 0 0 3.35-3.8C19.6 11.25 17.25 3.75 12 3.75S4.4 11.25 3.78 16.45a3.375 3.375 0 0 0 3.35 3.8z"/><path d="M7.875 13.5c.375-2.25 1.125-3.75 2.25-4.875"/><path d="M1.125 10.5c.75.75.75 2.25 0 3M22.875 10.5c-.75.75-.75 2.25 0 3"/></g></g>',
  // Drop
  creme: '<g class="ia ia-creme" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"><path class="an drop" d="M12 2.25c3.75 4.5 7.125 8.25 7.125 12.375a7.125 7.125 0 0 1-14.25 0C4.875 10.5 8.25 6.75 12 2.25z"/><ellipse class="an rip ia-x" cx="12" cy="22.6" rx="6" ry="1" stroke-width="1" opacity="0"/></g>',
};
