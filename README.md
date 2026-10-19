# references-mcp

An MCP server that brings curated references to your agent so you don't have to go looking.

Before your agent designs a landing page, cuts a launch film, drafts an ad or writes a post, it calls
`references_suggest`. It gets back a short set of directions drawn from work that has already been judged
good: award winners, editor-picked galleries, winning ads, top posts. It shows them to you, you pick one, and it
builds against that pick instead of an AI default.

## What comes back

`references_suggest({ intent: "landing page for an AI lab" })` returns:

- **`directions`**: ranked references, each with a url and a **`take`** (the specific thing to carry over).
  Your own library ranks first, then a canon of proven work.
- **`fresh`**: what's live right now:
  - **YouTube, most viewed** for your exact ask (video, motion, animation, ads, social; needs `yt-dlp`).
  - **The daily shelf**: this repo rebuilds `shelf/daily.json` every day (GitHub Action), from the latest
    uploads of brands known for the craft (Apple, Nike, Spotify, Airbnb, Duolingo, Figma, Kurzgesagt...)
    ranked by views, plus every live curation below.
  - **Live curations**: Awwwards Sites of the Day, One Page Love, Ads of the World, Vimeo Staff Picks,
    Motionographer, STASH, Vimeo Motion Graphics, Product Hunt, GitHub Trending, Hacker News best.
- **`curations`**: where to go deeper for that medium: Cannes Lions, D&AD, The One Show, Clios, Effies,
  Mobbin, Godly, Land-book, Pitch Deck Hunt, Meta Ad Library, TikTok Creative Center, and more.

Mediums: `ui` · `landing` · `app` · `deck` · `video` · `motion` · `animation` · `social` · `post` · `ad`.
If none is given, it is inferred from the intent ("pitch deck" → deck, "reel" → video, "campaign" → ad).

## Tools

| tool | does |
| --- | --- |
| `references_suggest` | directions + fresh picks + curations for what's being made |
| `references_get` | one reference in full |
| `references_pick` | records your choice in `taste.jsonl`; later suggestions lean toward what you keep picking |
| `references_add` | saves a link or screenshot plus its take into your library |

## Install

**Claude Code (server + picker):** one plugin brings the server and a mod that shows suggestions as picture
cards above your prompt. Pick with a click or `1`-`6`; `m` for more, `p` to let Claude pick.

```bash
claude plugin marketplace add sameeeeeeep/references-mcp
claude plugin install references@references
```

Then `/refs <what you're making>` asks on demand, and Claude asks on its own before it designs anything.

**Any MCP client (server only):**

```bash
claude mcp add references -s user -- npx -y github:sameeeeeeep/references-mcp
```

Or clone it and point the client at `node src/server.mjs`.

| env | default | |
| --- | --- | --- |
| `REFERENCES_DIR` | `~/.references` | your library, taste log and live cache |
| `REFERENCES_LIBRARIES` | none | extra read-only folders of references (`:`-separated) |
| `REFERENCES_LIVE` | `1` | `0` turns off live pulls (canon + library only) |

## The picker

When Claude calls `references_suggest`, the mod holds the call and shows up to six cards above the prompt: the best
directions plus one fresh pick per live curation, each with its picture, title and source. Your choice goes back to
Claude with the result. Thumbnails are fetched and shrunk on your machine (`curl` + `sips`, macOS); elsewhere the
cards show text only. Desktop app and terminal both draw it.

## Your library

A library is just folders. Each `.md` is one reference. Its image is the same-named sibling, or the folder's
only image:

```
~/.references/brand/ref-1.md
~/.references/brand/ref-1.png
```

```md
---
medium: landing
title: Our old hero
url: https://example.com
tags: lime, dark
---
Lime on black, one huge headline, product shot below the fold.
```

Frontmatter is optional. Without it, the medium is guessed from the folder name and the text.

## What it does not do

It links, it never rehosts: every card points at the original post. Instagram serves nothing without a
logged-in session, so social references come from the same brands' YouTube Shorts (Duolingo, Spotify, Nike,
Red Bull, GoPro, Netflix, Ryanair, Wendy's...), where most post the same vertical cuts. TikTok is not in:
it is unreachable in some regions.

## How it stays light

The server only links to the work and never rehosts it. Live sources are fetched only when a suggestion is
asked for, then cached for 12 hours. If a source is down, the last cache is used, or nothing; a suggestion
never fails because a site did.

## Add a curation

Sources live in [`src/sources.mjs`](src/sources.mjs). A pointer is one line. A live source also needs an
adapter: a url plus a `parse(text) → [{ title, url, image?, by?, note? }]`. The canon is in
[`src/catalog.mjs`](src/catalog.mjs).

MIT
