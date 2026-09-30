/*
  Your polish collection. Add one entry per polish:

  {
    id: "unique-id",           // any short unique text; saved combos refer to it
    name: "Name of polish",
    brand: "Brand name",
    effect: "magnetic",        // how the swatch is drawn: magnetic, sheermag (sheer magnetic), holo, thermal, multichrome, shimmer, glow
    effects: ["magnetic", "shimmer"], // optional: effect pills on the card and filters it shows up under (adds multichrome)
    colors: ["#1b1030", "#b89cff"],
    url: "https://...",        // optional: product page the polish came from
    photos: ["images/<id>/1.jpg"], // optional: photos saved from that page (kept in images/<id>/)
    shimmer: "#b0308a",        // optional: shimmer color suspended in the base
    shadow: "#2a1232",         // optional, magnetic: the deep color the edges fall into (default: darker base)
    clear: true,               // optional: a clear topper; on top of other layers only its shimmer and sparkle show
  },

  Colors per effect:
    sheer, creme, chrome, holo  -> [color]
    shimmer                     -> [base, shimmer]
    magnetic, sheermag          -> [base, flash, ...]  (list several flash colors for a multichrome shift)
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
             (defaults 1 and .1); colors gives each particle its own color, mixed in by mix (default .7); size scales them;
             dark is the share of particles turned away from the light, shown as darker flecks (default 0);
             deep is the share suspended deeper inside a sheer polish, drawn softer and dimmer (default 0)
    grain    optional, magnetic: strength of the fine light/dark speckle in the body (default .06)
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
    colors: ["#3a1432", "#bc64a0"], // [cold, warm], sampled from the darkest and lightest areas of the swatch photos
    thermal: { rest: .42 },    // mostly the mid plum of the in-between state, darker top-left, lighter bottom-right
    url: "https://www.mooncat.com/products/dark-omens",
    photos: ["images/mooncat-dark-omens/1.jpg", "images/mooncat-dark-omens/2.jpg", "images/mooncat-dark-omens/3.jpg", "images/mooncat-dark-omens/4.jpg"], // saved from the product page
  },
  {
    id: "mooncat-queen-of-the-dead",
    name: "Queen of the Dead",
    brand: "Mooncat",
    effect: "thermal",
    effects: ["thermal"],
    // Thermal: deep wine red when cold, raspberry red when warm (colors sampled from the cold/warm swatch grid)
    colors: ["#240710", "#a4102a"], // [cold, warm]
    thermal: { rest: .42 },
    url: "https://www.mooncat.com/products/queen-of-the-dead",
    photos: ["images/mooncat-queen-of-the-dead/1.jpg", "images/mooncat-queen-of-the-dead/2.jpg", "images/mooncat-queen-of-the-dead/3.jpg", "images/mooncat-queen-of-the-dead/4.jpg"], // saved from the product page
  },
  {
    id: "mooncat-banished-prince",
    name: "Banished Prince",
    brand: "Mooncat",
    effect: "thermal",
    effects: ["thermal", "flakies"],
    // Thermal: dark red when cold, bright red when warm, with iridescent orange-to-yellow-to-green flakies (sampled from the swatch grid)
    colors: ["#3a0a08", "#c41c0e"], // [cold, warm]
    thermal: { rest: .42 },
    flakes: ["#ff8a2a", "#ffb640", "#f0d848", "#a8d040"],
    url: "https://www.mooncat.com/products/banished-prince",
    photos: ["images/mooncat-banished-prince/1.jpg", "images/mooncat-banished-prince/2.jpg", "images/mooncat-banished-prince/3.jpg", "images/mooncat-banished-prince/4.jpg"], // saved from the product page
  },
  {
    id: "mooncat-koi-whiskers",
    name: "Koi Whiskers",
    brand: "Mooncat",
    effect: "thermal",
    effects: ["thermal", "shimmer"],
    // Thermal: coral when cold, pastel yellow when warm, with soft pink shimmer (sampled from the swatch grid)
    colors: ["#f8768a", "#fadb84"], // [cold, warm]
    thermal: { rest: .42 },
    shimmer: "#ffc4d8",
    url: "https://www.mooncat.com/products/koi-whiskers",
    photos: ["images/mooncat-koi-whiskers/1.jpg", "images/mooncat-koi-whiskers/2.jpg", "images/mooncat-koi-whiskers/3.jpg", "images/mooncat-koi-whiskers/4.jpg"], // saved from the product page
  },
  {
    id: "mooncat-jewel-beetle",
    name: "Jewel Beetle",
    brand: "Mooncat",
    effect: "multichrome",
    effects: ["multichrome", "shimmer"],
    // Multichrome: shifts pink -> gold -> green with the viewing angle (from the product page and photos)
    // Deep wine-magenta where it faces you, through hot pink and gold to yellow-green and green at the edges
    colors: ["#8e1450", "#d42a82", "#e07a3a", "#dcb030", "#a8c83a", "#3c9a3e"], // [facing, ..., edge]
    url: "https://www.mooncat.com/products/jewel-beetle",
    photos: ["images/mooncat-jewel-beetle/1.jpg", "images/mooncat-jewel-beetle/2.jpg", "images/mooncat-jewel-beetle/3.jpg", "images/mooncat-jewel-beetle/4.jpg"], // saved from the product page
  },
  {
    id: "mooncat-root-of-all-evil",
    name: "Root of All Evil",
    brand: "Mooncat",
    effect: "multichrome",
    effects: ["multichrome", "shimmer"],
    // Semi-sheer deep burgundy packed with teal-to-green-yellow shimmer. Drawn like a magnetic (a soft
    // glowing cloud of shimmer over the burgundy) but with one fixed shape: no glass bead / cat eye.
    glow: { shape: .3 },
    colors: ["#4c1026", "#62dca4", "#2cbcb2", "#3284cc", "#5a44a8", "#86286c"], // [base, flash...]
    shadow: "#2a0716",
    grad: [.5, .4],            // greener toward the upper left, violet toward the lower right
    // Halfway between shimmer and magnetic: a broader, softer glow, with shimmer particles packed
    // across the whole nail so the burgundy reads as sparkly rather than smooth.
    bead: { r: [.5, .52], glow: .75, span: .9 }, catEye: { width: .2, glow: .8 },
    shimmer: "#2e7e86",
    sparkle: { density: 3.5, size: 1.2, floor: .3, mix: .75, colors: ["#5ad8a8", "#3cb8c0", "#4a80d8", "#8a58c8", "#b0d860"] },
    url: "https://www.mooncat.com/products/root-of-all-evil",
    photos: ["images/mooncat-root-of-all-evil/1.jpg", "images/mooncat-root-of-all-evil/2.jpg", "images/mooncat-root-of-all-evil/3.jpg", "images/mooncat-root-of-all-evil/4.jpg"], // saved from the product page
  },
  {
    id: "mooncat-sin-eater",
    name: "Sin Eater",
    brand: "Mooncat",
    effect: "shimmer",
    effects: ["shimmer", "multichrome"],
    // Deep wine purple with subtle color-shifting red-to-orange-to-green shimmer (from the product page and photos)
    baseColor: "#4a1438",
    colors: ["#d6404c", "#e27a34", "#a0a044", "#4c7c3c"], // shimmer colors [facing, ..., sides]
    shadow: "#2a0a20",
    chrome: { grain: 1.3, cover: .9, sheen: 1.6 },
    url: "https://www.mooncat.com/products/sin-eater",
    photos: ["images/mooncat-sin-eater/1.jpg", "images/mooncat-sin-eater/2.jpg", "images/mooncat-sin-eater/3.jpg", "images/mooncat-sin-eater/4.jpg"], // saved from the product page
  },
  {
    id: "mooncat-garden-of-evil",
    name: "Garden of Evil",
    brand: "Mooncat",
    effect: "shimmer",
    effects: ["shimmer", "glitter"],
    // Moss green with violet shimmer and micro holographic glitter. In the photos the shimmer gathers into a
    // small, intense electric-violet glow where the light hits, over an otherwise solid green (from the photos).
    glow: { shape: .05, rot: 0 }, // glowing-spot swatch, fixed shape (no glass bead / cat eye), upright
    colors: ["#6c7c3c", "#ec5cff", "#cc2cee", "#9e3ed6", "#8c6a8c"], // [base, glow core -> edge]: magenta core, violet, then a mauve haze into the green
    shadow: "#4c5828",
    bead: { r: [.15, .36], glow: 1, span: .9 }, // a tall, narrow glow running down the nail
    shimmer: "#8e7aa8",        // faint violet shimmer across the green
    sparkle: { density: 2.6, size: 1.1, floor: .32, mix: .85, colors: ["#ffffff", "#f0a0ff", "#a0e0ff", "#fff0a0", "#b0ffb0", "#ffb0d0"] }, // micro holo glitter across the whole nail
    url: "https://www.mooncat.com/products/garden-of-evil",
    photos: ["images/mooncat-garden-of-evil/1.jpg", "images/mooncat-garden-of-evil/2.jpg", "images/mooncat-garden-of-evil/3.jpg", "images/mooncat-garden-of-evil/4.jpg"], // saved from the product page
  },
  {
    id: "mooncat-sand-viper",
    name: "Sand Viper",
    brand: "Mooncat",
    effect: "shimmer",
    effects: ["shimmer", "sheer"],
    // Sheer light pink-beige jelly with orange-red shimmer (from the product page and photos)
    baseColor: "#cc8e8c",
    colors: ["#f4907a", "#e4705e"], // shimmer colors [facing, ..., sides]
    shadow: "#9e6a6a",
    chrome: { grain: 1.1, cover: .5, sheen: 2.2, along: .1 },
    url: "https://www.mooncat.com/products/sand-viper",
    photos: ["images/mooncat-sand-viper/1.jpg", "images/mooncat-sand-viper/2.jpg", "images/mooncat-sand-viper/3.jpg", "images/mooncat-sand-viper/4.jpg"], // saved from the product page
  },
  {
    id: "mooncat-dark-horse",
    name: "Dark Horse",
    brand: "Mooncat",
    effect: "shimmer",
    effects: ["shimmer"],
    // Dark brown with warm light brown shimmer (from the product page and photos)
    baseColor: "#351a0c",
    colors: ["#e8aa64", "#c67e42", "#8a522a"], // shimmer colors [facing, ..., sides]
    shadow: "#1e0e06",
    chrome: { grain: .9, cover: .95, sheen: 1.4, along: .1, smooth: .85 }, // a soft gleam, not glitter
    url: "https://www.mooncat.com/products/dark-horse",
    photos: ["images/mooncat-dark-horse/1.jpg", "images/mooncat-dark-horse/2.jpg", "images/mooncat-dark-horse/3.jpg", "images/mooncat-dark-horse/4.jpg"], // saved from the product page
  },
  {
    id: "mooncat-petals-for-a-narcissist",
    name: "Petals for a Narcissist",
    brand: "Mooncat",
    effect: "shimmer",
    effects: ["shimmer", "sheer"],
    // Sheer white-gray with violet-pink shimmer (from the product page and photos)
    baseColor: "#fbf9fa",      // white base (per your request)
    colors: ["#ec62f2", "#b47af4", "#8a88e6"], // shimmer colors [facing, ..., sides]
    shadow: "#d8d2da",
    chrome: { grain: .9, cover: 1.15, sheen: 2.2, along: .1, smooth: .85 }, // a soft gleam, not glitter
    url: "https://www.mooncat.com/products/petals-for-a-narcissist",
    photos: ["images/mooncat-petals-for-a-narcissist/1.jpg", "images/mooncat-petals-for-a-narcissist/2.jpg", "images/mooncat-petals-for-a-narcissist/3.jpg", "images/mooncat-petals-for-a-narcissist/4.jpg"], // saved from the product page
  },
  {
    id: "mooncat-memento-mori",
    name: "Memento Mori",
    brand: "Mooncat",
    effect: "shimmer",
    effects: ["shimmer"],
    // Ivory with orange shimmer; reads as a soft lilac-grey ivory with a peach-orange flash in the photos
    baseColor: "#e2dfea",      // pale white with a cool blue-grey / lilac cast, as in your reference photos
    colors: ["#ff8a3e", "#f6a472"], // shimmer colors [facing, ..., sides]
    shadow: "#b9b5c6",
    chrome: { grain: .9, cover: .75, sheen: 4, along: .1, smooth: .4 }, // a narrow orange flash down the middle, soft with a little sparkle
    url: "https://www.mooncat.com/products/memento-mori",
    photos: ["images/mooncat-memento-mori/1.jpg", "images/mooncat-memento-mori/2.jpg", "images/mooncat-memento-mori/3.jpg", "images/mooncat-memento-mori/4.jpg"], // saved from the product page
  },
  {
    id: "mooncat-am-i-everything-you-fear",
    name: "Am I Everything You Fear?",
    brand: "Mooncat",
    effect: "shimmer",
    effects: ["shimmer", "multichrome", "glitter"],
    // Dusty deep teal with color-shifting pink-to-orange-to-green shimmer and micro holographic glitter (from the product page and photos)
    baseColor: "#1e4a4c",
    colors: ["#f274b4", "#ea9264", "#b4c264", "#52a684"], // shimmer colors [facing, ..., sides]
    shadow: "#0e2a2c",
    chrome: { grain: 1.3, cover: .95, sheen: 1.3 },
    url: "https://www.mooncat.com/products/am-i-everything-you-fear",
    photos: ["images/mooncat-am-i-everything-you-fear/1.jpg", "images/mooncat-am-i-everything-you-fear/2.jpg", "images/mooncat-am-i-everything-you-fear/3.jpg", "images/mooncat-am-i-everything-you-fear/4.jpg"], // saved from the product page
  },
  {
    id: "mooncat-the-avatar-state",
    name: "The Avatar State",
    brand: "Mooncat",
    effect: "glow",
    effects: ["glow", "shimmer", "sheer"],
    // Sheer milky white with blue shimmer by day; glows bright aqua in the dark (from the product page and photos)
    colors: ["#eef0f6", "#8ab6f2", "#a8cbff", "#c9dcff"], // [daylight base, shimmer...]
    glowColor: "#35f0d8",
    glowCore: "#c4fff4",
    url: "https://www.mooncat.com/products/the-avatar-state",
    photos: ["images/mooncat-the-avatar-state/1.jpg", "images/mooncat-the-avatar-state/2.jpg", "images/mooncat-the-avatar-state/3.jpg", "images/mooncat-the-avatar-state/4.jpg"], // saved from the product page
  },
  {
    id: "mooncat-green-eyed-monster",
    name: "Green Eyed Monster",
    brand: "Mooncat",
    effect: "glow",
    effects: ["glow", "shimmer"],
    // Milky white with green shimmer (with a hint of iridescent pink) by day; glows vivid green in the dark (from the product page and photos)
    colors: ["#f1f2ee", "#b8e6c4", "#9ad8b0", "#ecc8e0"], // [daylight base, shimmer...]
    glowColor: "#36f2a2",
    glowCore: "#c8ffe2",
    url: "https://www.mooncat.com/products/green-eyed-monster",
    photos: ["images/mooncat-green-eyed-monster/1.jpg", "images/mooncat-green-eyed-monster/2.jpg", "images/mooncat-green-eyed-monster/3.jpg", "images/mooncat-green-eyed-monster/4.jpg"], // saved from the product page
  },
  {
    id: "mooncat-moonlight-lullaby",
    name: "Moonlight Lullaby",
    brand: "Mooncat",
    effect: "glow",
    effects: ["glow", "shimmer"],
    // Icy white with blue undertones and white shimmer by day; glows white in the dark (from the product page and photos)
    colors: ["#dfe5f3", "#ffffff", "#c6d2f2", "#e2d8f4"], // [daylight base, shimmer...]
    glowColor: "#d8ecff",
    glowCore: "#ffffff",
    url: "https://www.mooncat.com/products/moonlight-lullaby",
    photos: ["images/mooncat-moonlight-lullaby/1.jpg", "images/mooncat-moonlight-lullaby/2.jpg", "images/mooncat-moonlight-lullaby/3.jpg", "images/mooncat-moonlight-lullaby/4.jpg"], // saved from the product page
  },
  {
    id: "ilnp-lily",
    name: "Lily",
    brand: "ILNP",
    effect: "sheermag",
    effects: ["sheer", "magnetic"],
    // Soft, see-through lilac with a silver magnetic sparkle, silver flakes and a holographic glint (from the product page and photos)
    colors: ["#a893b3", "#ffffff", "#f1ebf6", "#d2c3dc"],
    shadow: "#806889",         // edges only deepen a little, since the base is sheer
    grain: .18,
    bead: { glow: 1.35 }, catEye: { glow: 1.4 }, // a strong, easy-to-see magnetic flash
    // Packed with fine glitter everywhere, not just in the flash: mostly silver-white glints, some holographic
    // color, and some flakes turned away from the light as darker flecks, which gives it depth
    sparkle: { density: 9, floor: .4, deep: .35, size: 1.4, dark: .25, colors: ["#ffffff", "#ffffff", "#ffffff", "#f4f0ff", "#ff8fcf", "#86ceff", "#a8ff8c", "#ffdc7a"], mix: .8 },
    url: "https://www.ilnp.com/lily-soft-lilac-magnetic-holographic-nail-polish/",
    photos: ["images/ilnp-lily/1.jpg", "images/ilnp-lily/2.jpg", "images/ilnp-lily/3.jpg", "images/ilnp-lily/4.jpg"], // saved from the product page
  },
  {
    id: "ilnp-teddy",
    name: "Teddy",
    brand: "ILNP",
    effect: "sheermag",
    effects: ["sheer", "magnetic"],
    // Soft, see-through teddy bear brown with dense silver magnetic sparkle and a few holographic glints (from the product page and photos)
    colors: ["#b89588", "#ffffff", "#f8efe9", "#dcc4b8"],
    shadow: "#855f53",
    grain: .18,
    bead: { glow: 1.35 }, catEye: { glow: 1.4 }, // a strong, easy-to-see magnetic flash
    sparkle: { density: 9, floor: .4, deep: .35, size: 1.4, dark: .25, colors: ["#ffffff", "#ffffff", "#fff8f0", "#f6ece4", "#ff9fc8", "#8ccaff", "#b0f59a", "#ffd98a"], mix: .8 },
    url: "https://www.ilnp.com/teddy-light-teddy-bear-brown-magnetic-holographic-nail-polish/",
    photos: ["images/ilnp-teddy/1.jpg", "images/ilnp-teddy/2.jpg", "images/ilnp-teddy/3.jpg", "images/ilnp-teddy/4.jpg"], // saved from the product page
  },
  {
    id: "ilnp-moonlit",
    name: "Moonlit",
    brand: "ILNP",
    effect: "sheermag",
    effects: ["sheer", "magnetic"],
    // Sheer charcoal with a bright silver magnetic beam and scattered holographic flecks like stars (from the product page and photos)
    colors: ["#48464c", "#f6f7fb", "#c4c3cb", "#85838d"],
    shadow: "#26252a",
    grain: .2,
    bead: { glow: 1.35 }, catEye: { glow: 1.4 }, // a strong, easy-to-see magnetic flash
    sparkle: { density: 8, floor: .3, deep: .35, size: 1.4, dark: .2, colors: ["#ffffff", "#ffffff", "#eef0f6", "#ff6a5a", "#ffb347", "#6fe38a", "#5aa8ff", "#c77dff"], mix: .75 },
    url: "https://www.ilnp.com/moonlit-charcoal-magnetic-holographic-nail-polish/",
    photos: ["images/ilnp-moonlit/1.jpg", "images/ilnp-moonlit/2.jpg", "images/ilnp-moonlit/3.jpg", "images/ilnp-moonlit/4.jpg"], // saved from the product page
  },
  {
    id: "ilnp-bubbly",
    name: "Bubbly",
    brand: "ILNP",
    effect: "sheermag",
    effects: ["sheer", "magnetic"],
    clear: true,               // a clear topper: layered over another polish, only its shimmer and sparkle show
    // Clear topper with a bright silver magnetic shimmer, silver and holographic flakes: shown as cool, clear silver (from the product page and photos)
    colors: ["#c6cad2", "#ffffff", "#f2f4f8", "#dfe2e8"],
    shadow: "#98a0ac",
    grain: .12,
    bead: { glow: 1.35 }, catEye: { glow: 1.4 }, // a strong, easy-to-see magnetic flash
    flakes: ["#ffffff", "#e8e8f0", "#ffd6ec", "#d4ecff", "#e6ffd8"],
    sparkle: { density: 6, floor: .35, deep: .35, size: 1.4, dark: .1, colors: ["#ffffff", "#ffffff", "#ffffff", "#f2f2f6", "#ff9fd0", "#8fd0ff", "#b4ff9c"], mix: .8 },
    url: "https://www.ilnp.com/bubbly-silver-magnetic-topper-nail-polish/",
    photos: ["images/ilnp-bubbly/1.jpg", "images/ilnp-bubbly/2.jpg", "images/ilnp-bubbly/3.jpg", "images/ilnp-bubbly/4.jpg"], // saved from the product page
  },
  {
    id: "mooncat-bottled-rage",
    name: "Bottled Rage",
    brand: "Mooncat",
    effect: "shimmer",
    effects: ["shimmer"],
    // Dark burgundy red-black with fiery red-orange shimmer (from the product page and photos)
    baseColor: "#360810",
    colors: ["#ff5a2c", "#e2321e", "#a8141e", "#5c0a14"], // shimmer colors [facing, ..., sides]
    shadow: "#1a0306",
    chrome: { grain: 1.1, cover: .9, sheen: 1.8 },
    url: "https://www.mooncat.com/products/bottled-rage",
    photos: ["images/mooncat-bottled-rage/1.jpg", "images/mooncat-bottled-rage/2.jpg", "images/mooncat-bottled-rage/3.jpg", "images/mooncat-bottled-rage/4.jpg"], // saved from the product page
  },
  {
    id: "mooncat-moonjelly",
    name: "Moonjelly",
    brand: "Mooncat",
    effect: "shimmer",
    effects: ["sheer", "flakies"],
    // Sheer white jelly with electric blue shimmer, blue-to-green-to-purple-to-pink flakies and micro holo glitter;
    // on the nail it glows pinky-lilac with blue where the light hits (from the product page and photos)
    glow: { shape: .1, rot: 0 }, // glowing-spot swatch, fixed shape
    colors: ["#e8e2ee", "#f0b6e2", "#c8b0ff", "#9cc6ff", "#e2dcec"], // [base, glow core -> edge]: pink-lilac core, blue edges
    shadow: "#c8c0d6",
    bead: { r: [.44, .52], glow: .85, span: .95 },
    flakes: ["#6ab4ff", "#52d6b2", "#a878ff", "#ff84cc"],
    sparkle: { density: 2.4, size: 1, floor: .4, mix: .8, colors: ["#ffffff", "#8cc8ff", "#c8a0ff", "#ffb0dc", "#a8f0d0"] },
    url: "https://www.mooncat.com/products/moonjelly",
    photos: ["images/mooncat-moonjelly/1.jpg", "images/mooncat-moonjelly/2.jpg", "images/mooncat-moonjelly/3.jpg", "images/mooncat-moonjelly/4.jpg"], // saved from the product page
  },
  {
    id: "mooncat-deadly-nightshade",
    name: "Deadly Nightshade",
    brand: "Mooncat",
    effect: "multichrome",
    effects: ["shimmer"],
    // Ultra shifty shimmer: purple where it faces you, through blue and teal to green and gold at the edges
    // (from the product page and photos)
    colors: ["#5c2a82", "#6c48b4", "#3a6cc8", "#2aa092", "#58b85a", "#d0a83c"], // [facing, ..., edge]
    chrome: { smooth: .55 },   // a smooth, oily shift rather than coarse grain
    url: "https://www.mooncat.com/products/deadly-nightshade",
    photos: ["images/mooncat-deadly-nightshade/1.jpg", "images/mooncat-deadly-nightshade/2.jpg", "images/mooncat-deadly-nightshade/3.jpg", "images/mooncat-deadly-nightshade/4.jpg"], // saved from the product page
  },
];
