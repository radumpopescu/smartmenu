# Build plan: templates and the guest menu

This plan turns the working prototype into something an owner would put on every table. It is split so that the design work (templates, guest menu) and the plumbing (server, studio) can be built in parallel against one written contract.

## Status

Workstreams A, B and C are built. `npm run check` passes and the four demo menus render from the Worker at `/m/demo-osteria`, `/m/demo-carta`, `/m/demo-mercato` and `/m/demo-notte`. All four are also side by side at `/guest/gallery`.

Not yet verified:

- Menu import and AI photo edits, including cut-outs on a real page. They need an OpenAI key.
- A deployment to Cloudflare, edge caching at a real edge, and the GitHub Actions run.
- Safari and a physical phone. Everything was checked in Chromium at 375 px and 768 px.
- The demos have three photos between them. Each template needs a full set of fitting photos before the demos are used in a sales conversation.
- Interface words on the guest page ("Menu", "Not available today", the tag names) are English even on a Romanian menu.

## What the prototype gets wrong

These are the findings that shape the plan, in order of how much they cost the product.

1. **The guest menu is a client-rendered page inside the studio app.** A guest who scans the QR code downloads `index.html`, then the 24 KB studio script, then calls `/api/public/…`, and only then sees a dish. On restaurant Wi-Fi that is three round trips and a "Opening SmartMenu…" flash. A link pasted into WhatsApp shows no title or picture, and search engines see an empty page. The guest page must be one HTML response rendered by the Worker, with its CSS inline, cached at the edge.
2. **"Theme × layout × font" is a set of knobs, and the three layouts are nearly the same page.** Owners do not want twelve combinations that differ by a border. They want to pick a look that already works. A template has to own its typography, spacing, photo treatment and palettes together.
3. **Layout is chosen by a setting when it should be chosen by the content.** The product promise is "50 dishes and five good photos still looks good". That only holds if each section is composed from what it contains: a section where most dishes have photos becomes a photo grid, a section with none becomes a typographic list, and a featured dish with a photo gets a spread. No owner should have to configure that.
4. **A cut-out and a tabletop photo are different materials, and the page cannot tell them apart.** A transparent cut-out wants to float on the page colour, uncropped, with a soft shadow. A tabletop photo wants a framed crop. Today both get `object-fit: cover` in the same box, which crops plates and is the reason the "which default?" question in the product doc cannot be answered. The renderer needs to know each photo's size and kind.
5. **Photos reach phones at upload size.** Originals up to 6 MB are served as they were uploaded. One hero image can cost more than everything else on the page combined. Every upload should be downscaled in the browser before it is stored.
6. **The same module must render on the server and in the studio.** If the preview and the published page come from different code, they drift. The renderer is a pure function from menu data to HTML, in a file both the Worker and the browser import.
7. **The studio preview is a `div`, so it lies about breakpoints.** Media queries see the desktop window, which is why the stylesheet carries `.phone …` overrides. The preview should be an iframe with a real viewport, which also gives a phone/tablet toggle for free.
8. **The QR code encodes whatever hostname the owner happened to be on.** A code downloaded from a preview or `workers.dev` hostname is printed and laminated. The public origin must be configuration.
9. **Real menus carry facts the model has no place for.** Portion size ("350 g"), dietary markers, and a note under a section title ("Served until 12:00") appear on almost every printed menu. In Romania, portion weight, allergens and nutrition values on menus are also a consumer-protection matter, which is worth verifying with a restaurant owner because it could be the strongest sales argument we have.
10. **Nothing is tested and nothing is in version control.** `npm run check` only parses files.

## The contract

Everything below is the interface between the three workstreams. Change it only by editing this file.

### Menu data (version 2)

```
menu = {
  name, subtitle, currency,              // unchanged
  template: 'osteria' | 'carta' | 'mercato' | 'notte',
  palette:  string,                      // a key of that template's palettes
  accent:   '' | '#rrggbb',              // unchanged
  sections: [{
    id, name,
    note: string,                        // ≤ 160 chars, shown under the section title
    items: [{
      id, name, description, price, calories, allergens,   // unchanged
      portion: string,                   // ≤ 40 chars, free text: "350 g", "0.5 l"
      tags: string[],                    // subset of TAGS, no duplicates
      photo, originalPhoto, featured, available, review    // unchanged
    }]
  }],
  photos: { [photoId]: { w, h, cutout } }   // server-owned, read-only for clients
}
TAGS = ['vegetarian', 'vegan', 'gluten-free', 'spicy', 'new']
```

- `theme`, `layout` and `font` are gone. A stored draft that still has them is upgraded on read: `layout: 'classic'` becomes template `carta`, `layout: 'modern'` becomes `mercato`, anything else `osteria`; the old `theme` key is kept as `palette` when the template has a palette of that name, otherwise the template default is used.
- Missing `note`, `portion` and `tags` default to `''`, `''` and `[]`.
- `photos` is assembled by the server from the `photos` table. It is attached to the draft returned by the API and frozen into the published snapshot. Anything a client sends in `photos` is discarded. The renderer treats a missing entry as "unknown size, not a cut-out".

### Renderer: `public/guest/render.js`

A dependency-free ES module, imported by the Worker (`../public/guest/render.js`) and by the browser (`/guest/render.js`).

| Export | Purpose |
| --- | --- |
| `TAGS` | The tag keys above, with labels in `TAG_LABELS`. |
| `templates` | `{ [id]: { name, blurb, fonts, defaultPalette, palettes: { [key]: { name, bg, text, accent, … } } } }`. `fonts` is a Google Fonts stylesheet URL. |
| `designOf(menu)` | `{ template, palette, colors }`, applying the legacy upgrade and defaults. Never throws. |
| `renderMenu(menu, { idPrefix = 'm' })` | The menu as an HTML string. One root element, safe to assign to `innerHTML`. |
| `renderDocument(menu, { css, canonical, scriptSrc = '/guest/guest.js', lang = 'en' })` | A complete HTML document for server rendering: title, description, Open Graph tags, font links, `<style>` with `css`, the menu, and the script tag. |
| `escape`, `photoURL`, `formatPrice` | Helpers the studio already uses. |

Stylesheets live next to it: `base.css` plus one file per template (`osteria.css`, `carta.css`, `mercato.css`, `notte.css`). A page needs `base.css` and the one for its template. `guest.js` is optional progressive enhancement: the page is complete without it.

`public/guest/samples.js` exports `samples`, a map of demo slug to menu. Demo slugs are `demo-osteria`, `demo-carta`, `demo-mercato` and `demo-notte`. The old `osteria-verde-example` slug stays as an alias of `demo-osteria`.

`public/guest/frame.html` is the preview surface. Load it in an iframe at `/guest/frame`. It posts `{ type: 'sm-frame-ready' }` to its parent when it can render, and renders whatever arrives as `{ type: 'sm-preview', menu }`. It keeps the scroll position between renders. Both directions are same-origin only.

## Templates

Four templates, each with four palettes. Each one is a complete point of view on how a menu reads.

| Template | For | Character |
| --- | --- | --- |
| **Osteria** | Trattorias, bistros, anything with a signature dish | Editorial. A full-bleed opening photo, a large serif name, featured dishes as spreads. The evolution of the current look. |
| **Carta** | Places with few or no photos, wine lists, traditional restaurants | A printed carte. Centred, typographic, leader dots between dish and price, photos as small vignettes. Designed to be beautiful with zero photos. |
| **Mercato** | Cafés, brunch, burgers, bakeries | Bright and graphic. Rounded photo cards in a grid, pill navigation, chunky grotesque headings. |
| **Notte** | Cocktail bars, fine dining, evening venues | Dark and quiet. Thin capitals, generous spacing, cut-outs that glow against the background. |

Composition rules shared by all four:

- **Hero.** The first available featured dish with a tabletop photo, else the first available tabletop photo. Cut-outs are never stretched into a hero. Carta has no photo hero by design.
- **Section density.** Each section gets a mode from its own content: `rich` when at least two dishes and at least 60 % have photos, `plain` when none do, `mixed` otherwise. Templates style the three modes differently.
- **Featured.** With a photo, a featured dish gets the template's large treatment. Without one, it gets a typographic mark, so "featured" still means something on a text-only menu.
- **Cut-outs.** Shown whole on the page colour with a contact shadow, never cropped or boxed.
- **Unavailable.** Stays on the menu, dimmed and labelled, so regulars see it is only off today.
- **Details.** Tapping a dish opens a sheet with the large photo, full description, portion, calories and allergens. Without JavaScript everything is already on the page.
- **Diet filter.** Appears only when the menu uses tags.

## Workstreams

### A. Server (delegated to Opus)

1. Data model v2 in `src/menu.js`: validation, defaults, the legacy upgrade, `publishedMenu`.
2. Migration `0002`: `photos.width`, `photos.height`, `photos.cutout`. Uploads accept the browser-reported size, clamped. The queue marks transparent edits as cut-outs and records 1024 × 1024.
3. Attach `photos` to draft responses and freeze it into the published snapshot.
4. Server-render `/m/:slug` with `renderDocument`, CSS inlined through a Wrangler text-module rule, edge cached like the public API, with its own security headers. Demo slugs render from `samples.js` without the database. A missing menu gets a real 404 page.
5. `PUBLIC_ORIGIN` for QR codes and canonical URLs, falling back to the request origin when unset.
6. Tests with `node --test` for `menu.js` and the renderer, wired into `npm run check`, and a GitHub Actions workflow that runs it.

### B. Studio (delegated to Opus)

1. Replace the design tab with a template picker (four cards with a miniature of each), the palettes of the chosen template, accent, and **Surprise me** across template and palette.
2. Replace the preview `div` with the `/guest/frame` iframe and a phone/tablet toggle. Use it on the welcome page too.
3. New fields: section note, portion, tags.
4. Downscale every upload in the browser to at most 1600 px on the long side and send its dimensions.
5. Move to `render.js` and delete `menu-view.js`. Remove the guest route from `app.js` and the guest rules from `styles.css`.

### C. Design (Fable)

`render.js`, the five stylesheets, `guest.js`, `frame.html`, the demo menus, and the final review of every template at phone and tablet width.

## Later, deliberately not now

- **Translations.** Tourists are a large share of guests in the places we would sell to first. An AI-drafted second language that staff review is the most valuable feature after this plan.
- **Scan counts for the owner.** "Your menu was opened 312 times this week" is the cheapest retention feature available.
- **Price variants.** Glass and bottle, small and large. Needed before a wine list is comfortable.
- **Self-hosted fonts and responsive image sizes.** Both remove a third-party request or wasted bytes. Cloudflare Images can do the second once the account has it.
- **Structured allergens.** The fourteen EU allergens as icons and a filter, once a restaurant confirms how they record them today.
