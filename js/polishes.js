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
    sparkle  optional { density, floor, colors, mix, size }: more sparkles, how lit they stay outside the flash
             (defaults 1 and .1); colors gives each particle its own color, mixed in by mix (default .7); size scales them
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
    colors: ["#c28a70"],
    shadow: "#5e3c30",         // deeper bronze toward the edges
    url: "https://www.mooncat.com/products/fake-halo",
    photos: ["images/mooncat-fake-halo/1.jpg", "images/mooncat-fake-halo/2.jpg", "images/mooncat-fake-halo/3.jpg", "images/mooncat-fake-halo/4.jpg"], // saved from the product page
  },
  {
    id: "beesknees-knight-knave-optimist",
    name: "Knight, Knave, Optimist",
    brand: "Bee's Knees",
    effect: "magnetic",
    effects: ["magnetic", "shimmer"],
    // Dark grey-purple base; pinkish limestone shimmer glow with a dark purplish-blue streak and fine blue sparkle (from the photos)
    colors: ["#322a3a", "#e2cac4", "#bda8b4", "#7c6cd2", "#4c46d2", "#3834a0"],
    shadow: "#1a1520",
    grad: [.2, -.9],           // blue-violet toward the top of the glow, limestone lower down
    sparkle: { density: 2.2, floor: .3 }, // fine sparkle across the nail
    bead: { glow: .8 }, catEye: { glow: .85 }, // softer limestone glow, so the dark base shows
    url: "https://www.beeskneeslacquer.com/products/knight-knave-optimist",
    photos: ["images/beesknees-knight-knave-optimist/1.jpg", "images/beesknees-knight-knave-optimist/2.jpg", "images/beesknees-knight-knave-optimist/3.jpg", "images/beesknees-knight-knave-optimist/4.jpg"], // saved from the product page
  },
  {
    id: "beesknees-sprites",
    name: "Sprites",
    brand: "Bee's Knees",
    effect: "magnetic",
    effects: ["magnetic", "multichrome"],
    // Dark olive-grey base; mosaic magnetic whose particles flash many colors: white-pink core, magenta, violet and blue,
    // with red, green, gold and white glints mixed through (from the photos)
    colors: ["#22251c", "#f6dcf0", "#e676cc", "#a262e2", "#5a82e6", "#44bcc4"],
    shimmer: "#6c7a34",        // olive-green flecks in the base
    shadow: "#11130d",
    grad: [.5, .5],            // pink-white toward the upper left, blue-teal toward the lower right
    sparkle: { density: 2.2, size: 1.4, floor: .22, mix: 1, colors: ["#ff4a5a", "#ffffff", "#5ae07a", "#4a8aff", "#ff70d0", "#e8c060", "#b070ff"] },
    url: "https://www.beeskneeslacquer.com/products/sprites",
    photos: ["images/beesknees-sprites/1.jpg", "images/beesknees-sprites/2.jpg", "images/beesknees-sprites/3.jpg", "images/beesknees-sprites/4.jpg"], // saved from the product page
  },
  {
    id: "beesknees-soon-you-will-not-have-to-drown",
    name: "Soon You Will Not Have to Drown",
    brand: "Bee's Knees",
    effect: "magnetic",
    effects: ["magnetic", "multichrome"],
    // Deep navy base; mosaic magnetic with a rich gold and a purple pigment (from the product page)
    colors: ["#151a3a", "#e6e274", "#a6d470", "#6aa6a0", "#a45ee2", "#7438d0"],
    shadow: "#0a0d24",
    grad: [.9, .3],            // gold-green on one side, purple toward the other
    url: "https://www.beeskneeslacquer.com/products/soon-you-will-not-have-to-drown",
    photos: ["images/beesknees-soon-you-will-not-have-to-drown/1.jpg", "images/beesknees-soon-you-will-not-have-to-drown/2.jpg", "images/beesknees-soon-you-will-not-have-to-drown/3.jpg", "images/beesknees-soon-you-will-not-have-to-drown/4.jpg"], // saved from the product page
  },
  {
    id: "beesknees-im-nobody",
    name: "I'm Nobody",
    brand: "Bee's Knees",
    effect: "magnetic",
    effects: ["magnetic", "multichrome"],
    // Sepia olive-bronze base packed with pink and gold magnetic particles; bright pink core warming into gold (from the photos)
    colors: ["#6a4a24", "#f27aa8", "#ea8a6c", "#dca24a", "#bc8a36"],
    shimmer: "#c8a040",        // gold flecks in the base
    shadow: "#33230f",
    bead: { r: [.44, .46] }, catEye: { width: .1 }, // broad copper-pink glow
    sparkle: { density: 2.5, size: 1.2, floor: .28, mix: 1, colors: ["#ff5aa0", "#ff7ab8", "#f28cc0", "#e8b048", "#f09060", "#ffd070"] }, // dense pink and gold particles across the nail
    url: "https://www.beeskneeslacquer.com/products/im-nobody",
    photos: ["images/beesknees-im-nobody/1.jpg", "images/beesknees-im-nobody/2.jpg", "images/beesknees-im-nobody/3.jpg", "images/beesknees-im-nobody/4.jpg"], // saved from the product page
  },
  {
    id: "mooncat-dark-omens",
    name: "Dark Omens",
    brand: "Mooncat",
    effect: "thermal",
    effects: ["thermal"],
    // Thermal: deep purple-black when cold, light orchid purple when warm (from the product page and photos)
    colors: ["#361a38", "#9c5ca6"], // [cold, warm]
    thermal: { rest: .42 },    // mostly the mid plum of the in-between state, darker top-left, lighter bottom-right
    url: "https://www.mooncat.com/products/dark-omens",
    photos: ["images/mooncat-dark-omens/1.jpg", "images/mooncat-dark-omens/2.jpg", "images/mooncat-dark-omens/3.jpg", "images/mooncat-dark-omens/4.jpg"], // saved from the product page
  },
];
