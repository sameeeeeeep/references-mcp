export type Card = {
  id: string
  title: string
  take: string
  /** What the card shows under the title. */
  blurb: string
  source: string
  url?: string
  image?: string
  untrusted?: boolean
  /** The reference's own pictures, for the card's carousel. */
  gallery?: string[]
  /** A screen recording of the work, sampled into the card's moving preview. */
  videos?: string[]
  /** 'top' for page screenshots: the hero, not the middle. */
  crop?: 'top'
  /** 'Site of the Day' / 'Honorable Mention' for judged winners. */
  award?: string
}

export type Board = {
  /** The suggestion's tool call: its result row in the conversation draws the cards. */
  toolUseId: string
  intent: string
  medium: string | null
  cards: Card[]
  /** Bumps when a thumbnail lands, so the band redraws. */
  thumbs: number
  /** The card the person picked; it rides along with their next message. */
  selected: string | null
  /** Card id → the slide the person stepped to; absent, the carousel plays by itself. */
  pos: Record<string, number>
  /** The card open in the preview pane. */
  preview: string | null
  /** Which row of cards the band shows. */
  page: number
  /** The style quiz: which question is up and the option ids chosen so far; null when the medium has none. */
  quiz?: { step: number; picks: string[] } | null
  /** The quiz's questions, as the server sent them with the suggestion. */
  quizSteps?: { q: string; options: { id: string; label: string; hint: string; image?: string; tags: string[]; words: string; filters?: string[] }[] }[]
  /** True while the cards are being fetched again in the chosen style. */
  loading?: boolean
  /** The labels of the style the person chose, shown in the header. */
  styled?: string[]
  /** Hard filters in force (catalog tags), and the last ones loosened because too few matched. */
  filters?: string[]
  loosened?: string[]
  /** How many references match the filters. */
  matching?: number
  /** The next choices: tags among the matches, with how many each leaves. */
  facets?: { tag: string; count: number }[]
  /** The project in Claude's words, kept so refetches stay personal. */
  context?: string
  /** True while Claude reads the pool and shortlists. */
  curating?: boolean
}

declare module 'claude-code' {
  interface PluginState {
    references: { board: Board | null }
  }
}
