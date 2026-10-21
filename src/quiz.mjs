// The style quiz: a couple of taps before the cards, each option shown by a real example, so the person narrows
// the look by pointing instead of describing it. Answers go back into references_suggest as `style` (tags that
// lift matching canon) and `styleWords` (plain words added to the live YouTube search).
//
// Shape: { [medium]: [{ q, options: [{ id, label, hint, from, tags[], words, filters?, like? }] }] }. `like` is a title
// pattern for picking the option's example among the project's own references when no tag says it outright. `filters` are catalog tags
// (Awwwards' vocabulary) that the pick makes hard: only references carrying them come back. `from` is the example's
// page or video; its picture is looked up live (og:image / YouTube thumbnail) and cached.
const yt = (id) => `https://www.youtube.com/watch?v=${id}`;

const WHO_TALKS = { q: 'Who does the talking?', options: [
  { id: 'music', like: /\b(film|commercial|trailer|reveal|ad)\b/i, label: 'Music only', hint: 'Raycast', from: yt('Mi173xGb0ZA'), tags: ['no-voiceover', 'music'], words: '' },
  { id: 'voiceover', like: /\b(manifesto|think different|story|campaign|anthem|1984)\b/i, label: 'A voiceover', hint: 'Think Different', from: yt('5sMBhDv4sik'), tags: ['voiceover', 'manifesto'], words: 'voiceover' },
  { id: 'oncamera', like: /\b(introduces|keynote|founder|ceo|meet|jobs|interview|presents)\b/i, label: 'Someone on camera', hint: 'MKBHD', from: yt('XbXXKhfvSF0'), tags: ['talking-head', 'founder'], words: '' },
] };

export const QUIZZES = {
  video: [
    { q: 'What should it feel like?', options: [
      { id: 'cinematic', like: /\b(film|cinematic|commercial|1984|anthem|brand)\b/i, label: 'Cinematic & quiet', hint: 'Apple', from: yt('V3dbG9pAi8I'), tags: ['cinematic', 'premium', 'brand'], words: 'cinematic' },
      { id: 'product', like: /\b(introducing|demo|product|app|now available|meet)\b/i, label: 'Product glide', hint: 'Linear', from: yt('6dIwFoQ0eVg'), tags: ['product-demo', 'saas', 'dark'], words: 'product demo' },
      { id: 'founder', like: /\b(founder|ceo|jobs|introduces|keynote|story|why we|raises)\b/i, label: 'Founder & candid', hint: 'Arc', from: yt('n5Vwrj1gEWs'), tags: ['founder', 'candid', 'authentic'], words: 'founder story' },
      { id: 'punchy', like: /\b(trailer|teaser|reveal|in \d+ seconds|launch)\b/i, label: 'Fast & punchy', hint: 'Nothing', from: yt('oieVN1CLOaw'), tags: ['fast', 'short', 'energetic'], words: 'trailer' },
    ] },
    WHO_TALKS,
  ],
  ad: [
    { q: 'What kind of idea?', options: [
      { id: 'insight', like: /\b(real|truth|story|mother|mom|dad|life|love)\b/i, label: 'Emotional truth', hint: 'Dove', from: yt('MjzaAiZHAlc'), tags: ['emotional', 'insight', 'documentary'], words: 'emotional' },
      { id: 'absurd', like: /\b(funny|super bowl|guy|really|crazy|weird)\b/i, label: 'Absurd humour', hint: 'Old Spice', from: yt('CaT_oieImqw'), tags: ['humour', 'absurd', 'one-take'], words: 'funny' },
      { id: 'stance', like: /\b(anthem|dream|believe|just do|impossible|champion|running|sport)\b/i, label: 'A bold stance', hint: 'Nike', from: yt('-grjIUWKoBA'), tags: ['bold', 'stance', 'montage', 'inspirational'], words: 'inspirational' },
      { id: 'manifesto', like: /\b(manifesto|think different|1984|crazy ones|we believe)\b/i, label: 'A manifesto', hint: 'Think Different', from: yt('5sMBhDv4sik'), tags: ['manifesto', 'iconic', 'black-white'], words: 'manifesto' },
    ] },
    WHO_TALKS,
  ],
  ui: [
    { q: 'How dense?', options: [
      { id: 'dense', label: 'Dense, keyboard-first', hint: 'Linear', from: 'https://linear.app', tags: ['dense', 'keyboard', 'productivity'], words: '', filters: ['Interaction Design'] },
      { id: 'calm', label: 'Calm & airy', hint: 'Things', from: 'https://culturedcode.com/things/', tags: ['calm', 'whitespace', 'craft'], words: '', filters: ['Clean'] },
      { id: 'launcher', label: 'One input does it all', hint: 'Raycast', from: 'https://www.raycast.com', tags: ['launcher', 'command', 'native'], words: '', filters: ['Microinteractions'] },
      { id: 'playful', label: 'Playful hardware', hint: 'Teenage Engineering', from: 'https://teenage.engineering/products/op-1', tags: ['playful', 'hardware', 'retro', 'mono'], words: '', filters: ['Colorful'] },
    ] },
    { q: 'Light or dark?', options: [
      { id: 'dark', label: 'Dark', hint: 'Linear', from: 'https://linear.app', tags: ['dark'], words: '' },
      { id: 'light', label: 'Light', hint: 'Stripe', from: 'https://stripe.com', tags: ['light', 'clean'], words: '' },
    ] },
  ],
  landing: [
    { q: 'How should it open?', options: [
      { id: 'glow', label: 'Glowing product', hint: 'Linear', from: 'https://linear.app', tags: ['dark', 'glow', 'product-led'], words: '', filters: ['3D'] },
      { id: 'scroll', label: 'Scroll story', hint: 'Apple', from: 'https://www.apple.com/airpods-pro/', tags: ['scroll', 'cinematic', 'big-type'], words: '', filters: ['Scrolling'] },
      { id: 'gradient', label: 'Gradient & trust', hint: 'Stripe', from: 'https://stripe.com', tags: ['gradient', 'trust', 'polished'], words: '', filters: ['Colorful'] },
      { id: 'craft', label: 'Small & crafted', hint: 'rauno.me', from: 'https://rauno.me', tags: ['craft', 'minimal', 'subtle', 'personal'], words: '', filters: ['Minimal'] },
    ] },
    { q: 'What tone?', options: [
      { id: 'technical', label: 'Technical, black & white', hint: 'Vercel', from: 'https://vercel.com', tags: ['black-white', 'technical', 'grid', 'developer'], words: '', filters: ['Clean'] },
      { id: 'warm', label: 'Warm & friendly', hint: 'Headspace', from: 'https://www.headspace.com', tags: ['warm', 'friendly', 'illustration'], words: '', filters: ['Illustration'] },
      { id: 'loud', label: 'Loud & bold', hint: 'Liquid Death', from: 'https://liquiddeath.com', tags: ['bold', 'absurd', 'brand-voice'], words: '', filters: ['Experimental'] },
    ] },
  ],
  app: [
    { q: 'What should it feel like?', options: [
      { id: 'gamified', label: 'Playful & gamified', hint: 'Duolingo', from: 'https://www.duolingo.com', tags: ['playful', 'gamified', 'mascot'], words: '', filters: ['Colorful'] },
      { id: 'photo', label: 'Photo-first', hint: 'Airbnb', from: 'https://news.airbnb.com', tags: ['photo', 'marketplace', 'friendly'], words: '' },
      { id: 'calm', label: 'Calm & illustrated', hint: 'Headspace', from: 'https://www.headspace.com', tags: ['calm', 'illustration', 'warm'], words: '', filters: ['Illustration'] },
      { id: 'number', label: 'One big number', hint: 'Robinhood', from: 'https://robinhood.com', tags: ['minimal', 'data', 'bold', 'chart'], words: '' },
    ] },
  ],
  deck: [
    { q: 'What is the deck for?', options: [
      { id: 'pitch', label: 'Raising money', hint: 'Sequoia', from: 'https://www.sequoiacap.com/article/writing-a-business-plan/', tags: ['pitch', 'fundraise', 'investor'], words: '' },
      { id: 'keynote', label: 'A big reveal', hint: 'iPhone keynote', from: yt('MnrJzXM7a6o'), tags: ['keynote', 'reveal', 'dramatic', 'launch'], words: '' },
      { id: 'data', label: 'A data story', hint: 'Stripe Sessions', from: 'https://stripe.com/sessions', tags: ['data', 'charts', 'enterprise'], words: '' },
    ] },
    { q: 'How much on each slide?', options: [
      { id: 'one', label: 'One word or image', hint: 'Jobs', from: yt('MnrJzXM7a6o'), tags: ['minimal', 'big-type', 'black'], words: '' },
      { id: 'simple', label: 'A simple point', hint: 'Airbnb 2008', from: yt('uuxnzuH3XiM'), tags: ['simple', 'narrative'], words: '' },
      { id: 'dense', label: 'Charts & numbers', hint: 'Stripe', from: 'https://stripe.com/sessions', tags: ['data', 'charts', 'polished'], words: '' },
    ] },
  ],
  motion: [
    { q: 'What kind of motion?', options: [
      { id: 'ambient', like: /\b(ambient|loop|gradient|calm)\b/i, label: 'Ambient & slow', hint: 'Stripe', from: 'https://stripe.com', tags: ['gradient', 'ambient', 'subtle'], words: 'ambient' },
      { id: 'fluid', like: /\b(ui|transition|interaction|app)\b/i, label: 'Fluid transitions', hint: 'Family', from: 'https://benji.org/family-values', tags: ['fluid', 'micro-interaction', 'spring', 'transition'], words: 'ui animation' },
      { id: 'reveal', like: /\b(reveal|product|3d|launch)\b/i, label: 'Product reveal', hint: 'Apple', from: 'https://www.apple.com', tags: ['reveal', 'cinematic', '3d', 'premium'], words: 'product reveal' },
      { id: 'interactive', like: /\b(interactive|rive|game|play)\b/i, label: 'Reacts to you', hint: 'Rive', from: 'https://rive.app', tags: ['interactive', 'state-machine', 'playful'], words: 'interactive' },
    ] },
  ],
  animation: [
    { q: 'What style?', options: [
      { id: 'flat', like: /\b(explainer|explained|kurzgesagt|flat)\b/i, label: 'Flat vector explainer', hint: 'Kurzgesagt', from: yt('_y9JuojAIg0'), tags: ['flat', 'vector', 'explainer'], words: 'explainer' },
      { id: 'comic', like: /\b(comic|stylised|stylized|2d|hand-?drawn)\b/i, label: 'Comic texture', hint: 'Spider-Verse', from: 'https://www.sonypictures.com/movies/spidermanintothespiderverse', tags: ['comic', 'texture', 'stylised', 'bold'], words: 'stylised' },
      { id: 'characters', like: /\b(character|mascot|cute|short film)\b/i, label: 'Simple characters', hint: 'Duolingo', from: 'https://blog.duolingo.com', tags: ['character', 'geometric', 'expressive', 'mascot'], words: 'character' },
    ] },
  ],
  social: [
    { q: 'What voice?', options: [
      { id: 'mascot', like: /\b(mascot|duo|trend|tiktok)\b/i, label: 'Mascot on trends', hint: 'Duolingo', from: yt('P5Lug4uY8JE'), tags: ['mascot', 'trend', 'native'], words: '' },
      { id: 'absurd', label: 'Absurd & loud', hint: 'Liquid Death', from: 'https://liquiddeath.com', tags: ['bold', 'absurd', 'brand-voice'], words: '' },
      { id: 'teach', like: /\b(how|tips|learn|explained|guide)\b/i, label: 'Clean & teaching', hint: 'Notion', from: 'https://www.notion.com', tags: ['carousel', 'education', 'clean'], words: '' },
      { id: 'selfaware', like: /\b(funny|humou?r|ryanair|self)\b/i, label: 'Self-aware humour', hint: 'Ryanair', from: yt('R7qGqWdm9lc'), tags: ['humour', 'self-aware', 'trend'], words: '' },
    ] },
  ],
  post: [
    { q: 'What voice?', options: [
      { id: 'essay', label: 'A plain essay', hint: 'Paul Graham', from: yt('2OZ94b3fJvo'), tags: ['essay', 'plain', 'thoughtful', 'longform'], words: '' },
      { id: 'raw', label: 'Raw build-in-public', hint: 'levelsio', from: 'https://levels.io', tags: ['build-in-public', 'raw', 'numbers', 'indie'], words: '' },
      { id: 'tactical', label: 'Tactical deep-dive', hint: "Lenny's", from: 'https://www.lennysnewsletter.com', tags: ['tactical', 'frameworks', 'newsletter'], words: '' },
      { id: 'hook', label: 'Short-line hooks', hint: 'LinkedIn format', from: 'https://www.justinwelsh.me', tags: ['hook', 'short', 'skimmable', 'linkedin'], words: '' },
    ] },
  ],
};
