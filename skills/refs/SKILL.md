---
name: refs
description: Show curated reference directions (award winners, galleries, winning ads, top posts, most-watched videos) for what the person is making, as picture cards above their prompt. Use for "/refs <what you're making>", "show me references", "references for…", "what should this look like", or before designing anything with a look or a voice when the person wants to choose a direction first.
argument-hint: <what you're making, e.g. "launch film for a Mac app">
---

# /refs

The person wants reference directions for: **$ARGUMENTS**

1. Call `references_suggest` with `intent` set to exactly what they are making (their words above). Pass `medium` only
   if it is obvious (ui, landing, app, deck, video, motion, animation, social, post, ad); otherwise leave it out.
2. The results appear to the person as picture cards above their prompt. Do not list or describe them again.
3. End your turn with one short line inviting them to pick a card and add anything they want. Don't build yet.

Their pick arrives with their next message as a `[Reference picked]` note; build against its take then. If they name a
card in words instead ("go with Shot on iPhone"), use that one. If `$ARGUMENTS` is empty, ask in one line what they
are making.
