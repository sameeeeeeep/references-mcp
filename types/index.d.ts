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
}

declare module 'claude-code' {
  interface PluginState {
    references: { board: Board | null }
  }
}
