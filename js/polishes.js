/*
  Your polish collection. Add one entry per polish:

  {
    id: "unique-id",           // any short unique text; saved combos refer to it
    name: "Name of polish",
    brand: "Brand name",
    effect: "magnetic",        // how the swatch is drawn: sheer, magnetic, holo, shimmer, chrome, creme, glitter, flakies, duochrome
    effects: ["magnetic", "shimmer"], // optional: effect pills on the card and filters it shows up under (adds multichrome)
    colors: ["#1b1030", "#b89cff"],
    url: "https://...",        // optional: product page the polish came from
    photos: ["images/<id>/1.jpg"], // optional: photos saved from that page (kept in images/<id>/)
    shimmer: "#b0308a",        // optional: shimmer color suspended in the base
    shadow: "#2a1232",         // optional, magnetic: the deep color the edges fall into (default: darker base)
  },

  Colors per effect:
    sheer, creme, chrome, holo  -> [color]
    shimmer                     -> [base, shimmer]
    magnetic                    -> [base, flash, ...]  (list several flash colors for a multichrome shift)
    glitter, flakies            -> [base tint, particle, particle]
    duochrome                   -> [color A, color B]

  Magnetic polishes show a glass bead finish by default and a cat eye stripe on hover.
  Optional tuning:
    grad     [across, down]: colors also slide this far along the flash list across the swatch
    bead     glass bead overrides: { r: [width, height], span, glow }
    catEye   cat eye overrides: { width, span, glow }
      r/width  glow size as a fraction of the swatch     span  how far along the flash colors the edges reach
      glow     how strongly the flash covers the base at its heart (default 1)
    flakes   optional list of flakie colors; they shift through the list as you hover (iridescent)
    glitter  optional color of small hex glitter
    holo     optional, holographic only: { strength, width, angle } how vivid the rainbow streak is, how wide, and its tilt
    sparkle  optional { density, floor }: more sparkles, and how lit they stay outside the flash (defaults 1 and .1)
*/
const POLISHES = [
  {
    id: "mooncat-404-soul-not-found",
    name: "404: Soul Not Found",
    brand: "Mooncat",
    effect: "magnetic",
    effects: ["magnetic", "multichrome"],
    // Near-black base with a deep purple undertone; multichrome flash shifting teal -> blue -> purple -> magenta (from the product photos)
    colors: ["#150d24", "#14d28c", "#18b4b4", "#3c78e6", "#8c3ceb", "#dc46d7"],
    url: "https://www.mooncat.com/products/404-soul-not-found",
    photos: ["images/mooncat-404-soul-not-found/1.jpg", "images/mooncat-404-soul-not-found/2.jpg", "images/mooncat-404-soul-not-found/3.jpg", "images/mooncat-404-soul-not-found/4.jpg"], // saved from the product page
    shadow: "#1f0f33",         // edges fall into deep indigo-purple, as in the photos
    grad: [1, .5],             // greener upper left, violet to magenta toward the lower right
  },
  {
    id: "mooncat-fields-of-lavender",
    name: "Fields of Lavender",
    brand: "Mooncat",
    effect: "magnetic",
    // Mauve purple base; red-orange flash, golden where it's brightest (from the product photos)
    shadow: "#2a1232",         // deep plum at the edges
    colors: ["#3a1d42", "#f5a860", "#e8703c", "#c8463a", "#9a2c4a"],
    url: "https://www.mooncat.com/products/fields-of-lavender",
    photos: ["images/mooncat-fields-of-lavender/1.jpg", "images/mooncat-fields-of-lavender/2.jpg", "images/mooncat-fields-of-lavender/3.jpg", "images/mooncat-fields-of-lavender/4.jpg"], // saved from the product page
  },
  {
    id: "mooncat-pandoras-box",
    name: "Pandora's Box",
    brand: "Mooncat",
    effect: "magnetic",
    effects: ["magnetic", "shimmer"],
    // Wine burgundy base; golden core that runs through amber into a wide magenta-violet glow (from the product photos)
    colors: ["#4a0f30", "#f4c645", "#e08a34", "#c42a8a", "#9a2cc4", "#7a1e8e"],
    shimmer: "#d44ab8",
    bead: { span: 1 },         // let the glow reach all the way into magenta and violet
    catEye: { span: 1 },
    grad: [0, -.6],            // violet-magenta toward the top, gold lower down, as in the photos
    shadow: "#330b22",         // deep wine at the edges
    url: "https://www.mooncat.com/products/pandoras-box",
    photos: ["images/mooncat-pandoras-box/1.jpg", "images/mooncat-pandoras-box/2.jpg", "images/mooncat-pandoras-box/3.jpg", "images/mooncat-pandoras-box/4.jpg"], // saved from the product page
  },
  {
    id: "mooncat-jasmine-dragon",
    name: "Jasmine Dragon",
    brand: "Mooncat",
    effect: "magnetic",
    effects: ["magnetic", "flakies", "glitter"],
    // Deep rust-red base packed with fine orange shimmer; soft, velvety orange flash (from the product photos)
    colors: ["#520f06", "#ff7a26", "#e8501c", "#c8321a", "#9a1c14"],
    shadow: "#300905",         // deep red-brown at the edges
    bead: { r: [.48, .5], glow: .6 }, // broad, velvety glow rather than a tight bead
    sparkle: { density: 5, floor: .6 }, // dense fine glitter that stays lit across the whole nail
    flakes: ["#ffb040", "#ff7a2a", "#d8481c", "#b8c83a"], // small yellow -> orange -> green iridescent flakies
    glitter: "#e0301c",        // red glitter
    url: "https://www.mooncat.com/products/jasmine-dragon",
    photos: ["images/mooncat-jasmine-dragon/1.jpg", "images/mooncat-jasmine-dragon/2.jpg", "images/mooncat-jasmine-dragon/3.jpg", "images/mooncat-jasmine-dragon/4.jpg"], // saved from the product page
  },
  {
    id: "mooncat-fake-halo",
    name: "Fake Halo",
    brand: "Mooncat",
    effect: "holo",
    effects: ["holo"],
    // Rose gold linear holographic: copper rose gold packed with holo particles; rainbow streak through the light (from the photos)
    colors: ["#b27a5c"],
    shadow: "#5e3c30",         // deeper bronze toward the edges
    url: "https://www.mooncat.com/products/fake-halo",
    photos: ["images/mooncat-fake-halo/1.jpg", "images/mooncat-fake-halo/2.jpg", "images/mooncat-fake-halo/3.jpg", "images/mooncat-fake-halo/4.jpg"], // saved from the product page
  },
];
