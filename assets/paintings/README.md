# Paintings: main menu and loading screens

Oil-painting backgrounds for Dot War. Each one restages a famous painting with WW2-era soldiers
(no insignia, no flags of real nations), generated with ChatGPT from the prompts at the bottom of
this file. On top of each still image, `painting-fx.js` animates a few small details so the
screens feel alive without looking edited: candle flicker, dust drifting in light beams,
cigarette and battlefield smoke, rising embers, falling snow, sparkles on water, birds, and an
occasional glint on helmets and metal.

Status: approved look, not wired into the game yet. The menu buttons, the loading indicator and
any click or hover effects are to be built in the game UI (see "For Claude Code" below).

## Files

| File | Painting | Used for | Animated details |
|---|---|---|---|
| `menu/the-calling.jpg` | The calling, after Caravaggio | Main menu | Candle flicker, dust in the window beam, cigarette smoke, glints |
| `loading/01-the-crossing.jpg` | The crossing, after Leutze | Loading | Sun pulse, snow, sparkles on the ice water, glints |
| `loading/02-over-the-barricade.jpg` | Over the barricade, after Delacroix | Loading | Fire glow, rising embers, dark smoke, glints |
| `loading/03-the-company-moves-out.jpg` | The company moves out, after Rembrandt | Loading | Dust in the sunbeam, light pulse, glints |
| `loading/04-the-war-council.jpg` | The war council, after Raphael | Loading | Birds in the arch sky, dust, glints |
| `loading/05-the-last-mess.jpg` | The last mess, after Leonardo | Loading | Candle flicker, smoke in the three windows, dust, glints |
| `loading/06-the-light.jpg` | The light, after Michelangelo | Loading | Tiny ember and smoke at the cigarette tip, dust, glints |

- `painting-fx.js`: the effect engine plus every painting's effect settings. No UI. Classic
  script defining one global, `PaintingFx`, like the files in `js/`.
- `bare.html`: every painting full screen with its animation and nothing else. Choose one with
  the hash (`bare.html#the-light`) or cycle with the left and right arrow keys.
- `reference/menu-preview.html`, `reference/loading-preview.html`: the agreed look of the menu
  and loading screen, with mock buttons, plaque and progress bar. Design references only.

All images are 1672 x 941 JPEGs (16:9). Coordinates in `painting-fx.js` are in those image
pixels. To preview, run `python serve.py 8765` from the repo root and open
`http://localhost:8765/assets/paintings/bare.html`.

## Using the engine

```js
const fx = PaintingFx.create(canvas, { base: 'assets/paintings/' });
fx.show('the-calling').then(() => fadeIn());  // resolves when the image has loaded
fx.start();                                   // requestAnimationFrame loop
fx.stop();                                    // stop when the screen is hidden (important in game)
PaintingFx.ids('loading');                    // ['the-crossing', 'over-the-barricade', ...]
PaintingFx.info('the-light');                 // { title, after, file, use, fx }
```

The canvas takes its size from CSS; the engine resizes the backing store for the device pixel
ratio and cover-fits the painting (cropping, never letterboxing). `anchorX` on a painting picks
which side survives the crop on narrow screens: the menu uses 0.75 to keep the figures.
`prefers-reduced-motion` draws the still image with no effects (override with
`{ reducedMotion: false }`).

## For Claude Code: building the real screens

Main menu (`js/menu.js`, the planned UI rework):
- Background is `the-calling`. The left 40% of the painting is deliberately near-black empty
  space for the menu. Buttons are white serif text on the dark area (preview uses IM Fell English
  SC for the title and Cormorant Garamond for buttons; any similar serif works).
- Add the hover and click feedback in the UI layer, for example a warm underline on hover and a
  short brightening flash on click. If a click effect should touch the painting (say a candle
  flare), add it as a new `fx` type in `painting-fx.js` rather than drawing it in `menu.js`.
- Stop the engine when a match starts, so it does not cost frames during play.

Loading screen:
- Pick a random `ids('loading')` painting per load, show its title and "after ..." line as a
  plaque bottom left and a thin gold progress bar bottom right over a dark bottom gradient,
  as in `reference/loading-preview.html`.
- Drive the bar from real loading progress. Fade from black into the painting once `show()`
  resolves.

Decisions already made, keep them:
- No waving flags or any other warping of the painted image. It was tried and removed: moving
  parts of the picture look edited and distort what is around them. Effects only add light and
  particles on top.
- In `the-light` the ember at the cigarette tip stays tiny; a bigger glow read as the cigarette
  catching fire.
- No insignia anywhere. Known issue: in `06-the-light.jpg` the officer's cap still shows an
  eagle badge. Regenerate that image with "plain cap with no badge or emblem" before release and
  keep the file name and framing so the effect coordinates still line up.

## Making more paintings

Prompt formula that worked (ChatGPT image generation, 16:9):

> Oil painting in the style of [artist]'s "[painting]", exact composition: [the same scene with
> WW2-era soldiers in olive drab uniforms and steel helmets with no insignia, plain unmarked
> flags]. [Period style words: sfumato / chiaroscuro / tenebrism / Romantic brushwork], thick
> oil brushwork, aged varnish, fine craquelure, museum masterpiece. 16:9, no text, no symbols,
> no patches, no emblems.

For a menu background, add: "The entire left 40% of the canvas is deep, near-black shadow,
completely empty of figures and detail, as negative space." When adding a painting, add an
entry to `PAINTINGS` in `painting-fx.js` with its effect points, and check it in `bare.html`.
