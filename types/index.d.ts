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
}

export type Board = {
  intent: string
  medium: string | null
  cards: Card[]
  /** Bumps when a thumbnail lands, so the band redraws. */
  thumbs: number
  /** The card the person picked; it rides along with their next message. */
  selected: string | null
}

declare module 'claude-code' {
  interface PluginState {
    references: { board: Board | null }
  }
}
