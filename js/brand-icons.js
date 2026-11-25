/* Icons for the brand filter pills, each based on the brand's logo (Cecilia's picks). Same format as
   js/icons.js: the inside of a 24x24 SVG in currentColor, so it turns white with the text when the pill
   is picked. */
const BRAND_ICONS = {
  // Eye in a moon
  "Mooncat": '<g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"><circle cx="12" cy="10.5" r="6.75"/><path d="M12 5.25c1.4 2.6 1.4 7.9 0 10.5-1.4-2.6-1.4-7.9 0-10.5z"/><path d="M3.75 14.25a8.6 8.6 0 0 0 16.5 0"/></g>',
  // Heart in a bottle
  "ILNP": '<g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"><path d="M9.75 2.25h4.5v4.5h-4.5zM7.5 6.75h9a1.5 1.5 0 0 1 1.5 1.5v11.25a2.25 2.25 0 0 1-2.25 2.25h-7.5A2.25 2.25 0 0 1 6 19.5V8.25a1.5 1.5 0 0 1 1.5-1.5z"/></g><path fill="currentColor" d="M12 18s-3-1.8-3-3.9a1.5 1.5 0 0 1 3-.3 1.5 1.5 0 0 1 3 .3C15 16.2 12 18 12 18z"/>',
  // Two hearts, after the hearts on the bottle
  "Awesome Nail Polish": '<g transform="translate(7.25 7.75) rotate(-12) scale(.98)"><path fill="none" stroke="currentColor" stroke-width="1.53" stroke-linejoin="round" stroke-linecap="round" d="M0 6S-6 2.5-6-1.5a3 3 0 0 1 6-.6 3 3 0 0 1 6 .6C6 2.5 0 6 0 6z"/></g><g transform="translate(17.75 17.25) rotate(10) scale(.76)"><path fill="none" stroke="currentColor" stroke-width="1.97" stroke-linejoin="round" stroke-linecap="round" d="M0 6S-6 2.5-6-1.5a3 3 0 0 1 6-.6 3 3 0 0 1 6 .6C6 2.5 0 6 0 6z"/></g>',
  // Hexagon bk (logo)
  "Bee's Knees": '<g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"><path d="M7 3.35h10L22 12l-5 8.65H7L2 12z"/><path d="M8.25 7.5v9M8.25 13.5a1.6 1.6 0 1 1 0 .01M8.25 13.2c.1-1.5 3.1-1.7 3.1.75s-3 2.3-3.1.75M14.25 7.5v9M14.25 13.5l3-2.25M15.4 12.6l1.85 3.9"/></g>',
  // CR/ACK/ED stacked, after their round badge
  "Cracked Polish": '<g fill="currentColor" font-family="Helvetica Neue,Arial,sans-serif" font-weight="800" font-size="7.6" letter-spacing="-.3" text-anchor="middle"><text x="12" y="7.6">CR</text><text x="12" y="14.6">ACK</text><text x="12" y="21.6">ED</text></g>',
  // Tiara
  "Pretty Diva": '<g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"><path d="M2.25 18.75c3-1.5 6.25-2.25 9.75-2.25s6.75.75 9.75 2.25M4.5 17.6 3.75 10.5l3.75 3 1.5-6 3 4.5 3-4.5 1.5 6 3.75-3-.75 7.1"/><path d="M12 3.75l1.1 1.5L12 6.75l-1.1-1.5z"/></g>',
};
