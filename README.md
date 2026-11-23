# Mind Fusion — website

Marketing site for **Mind Fusion** (mindfusionvisuals.com), a film & photography production company.
Built with [Eleventy](https://www.11ty.dev/) — plain HTML/Nunjucks, one CSS file, one dependency-free JS file.

## Develop

```sh
npm install
npm start          # http://localhost:8080
npm run build      # outputs to dist/
```

## Where things live

| Path | What |
| --- | --- |
| `src/_data/site.json` | Brand, SEO defaults, contact, socials |
| `src/_data/projects.json` | The six work chapters (copy, stills, alt text) |
| `src/_data/testimonials.json` | "What they said" quotes |
| `src/index.njk` | Homepage markup |
| `src/_includes/base.njk` | `<head>`: meta, Open Graph, icons, fonts |
| `src/assets/css/main.css` | Design system + all layout |
| `src/assets/js/main.js` | Interactions (hero letterbox, previews, films, timeline, lightbox) |
| `src/assets/img/` | Stills at 960 / 1600 / 2400 px |
| `src/assets/video/` | Web encodes (`*.mp4` 1920px, `*-sm.mp4` 1280px muted) |
| `source-assets/` | Untouched originals from the Framer site + `MAP.txt` (git-ignored) |

## Adding a project

1. Export three 16:9 stills and a short clip; the second still doubles as the video poster.
2. Encode them like the existing files (see `source-assets/MAP.txt` for naming).
3. Add an entry to `src/_data/projects.json`. Set `"aspect": "2.39/1"` for scope-framed work.
