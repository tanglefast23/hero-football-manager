export type EventSuccessPalette = 'violet' | 'red' | 'blue' | 'gold' | 'pitch' | 'grey';

export interface EventSuccessMotif {
  symbol: string;
  caption: string;
  palette: EventSuccessPalette;
}

/**
 * Authored comic motifs for every launch risky-success cutscene.
 *
 * The event screen composes these over the category illustration. Keeping the
 * story-specific layer in data makes it impossible for a newly-authored event
 * to silently ship with only the generic category image.
 */
export const EVENT_SUCCESS_MOTIFS: Readonly<Record<string, EventSuccessMotif>> = {
  'event-giant-spider-success': { symbol: 'SPDR', caption: 'Mascot crowned', palette: 'gold' },
  'event-meteor-shard-success': { symbol: 'METR', caption: 'Meteor museum', palette: 'blue' },
  'event-lightning-training-success': { symbol: 'BOLT', caption: 'Thunder drill', palette: 'gold' },
  'event-energy-salesman-success': { symbol: 'BOOST', caption: 'Cone blur', palette: 'violet' },
  'event-abandoned-lab-success': { symbol: 'LAB', caption: 'Grant unlocked', palette: 'blue' },
  'event-radioactive-paint-success': { symbol: 'GLOW', caption: 'Night pitch', palette: 'pitch' },
  'event-old-boot-success': { symbol: 'BOOT', caption: 'Top corner', palette: 'gold' },
  'event-team-bbq-success': { symbol: 'BBQ', caption: 'Onion honours', palette: 'red' },
  'event-prank-war-success': { symbol: 'PRNK', caption: 'Board victorious', palette: 'violet' },
  'event-lost-mascot-success': { symbol: 'MASC', caption: 'Parade home', palette: 'gold' },
  'event-kit-clash-success': { symbol: 'KIT', caption: 'Cult colours', palette: 'violet' },
  'event-trophy-rat-success': { symbol: 'RAT', caption: 'Tiny curator', palette: 'grey' },
  'event-hero-expose-success': { symbol: 'NEWS', caption: 'Front page hero', palette: 'blue' },
  'event-viral-goal-success': { symbol: 'SONG', caption: 'Terrace anthem', palette: 'gold' },
  'event-pundit-tactics-success': { symbol: 'TACT', caption: 'Studio won', palette: 'blue' },
  'event-popup-sponsor-success': { symbol: 'ZZZ', caption: 'Nap campaign', palette: 'violet' },
  'event-hero-commercial-success': { symbol: 'HERO', caption: 'Cereal legend', palette: 'gold' },
  'event-player-slump-success': { symbol: 'DRGN', caption: 'Confidence slain', palette: 'red' },
  'event-homesick-youth-success': { symbol: 'HOME', caption: 'Bakery day', palette: 'pitch' },
  'event-lottery-win-success': { symbol: 'WIN', caption: 'Named chairs', palette: 'gold' },
  'event-player-feud-success': { symbol: 'DUET', caption: 'Locker anthem', palette: 'violet' },
  'event-agent-whispers-success': { symbol: 'RUSE', caption: 'Phantom scouted', palette: 'grey' },
  'event-flu-wave-success': { symbol: 'SOUP', caption: 'Miracle lunch', palette: 'red' },
  'event-miracle-physio-success': { symbol: 'GONG', caption: 'Treatment rings', palette: 'gold' },
  'event-ultras-tickets-success': { symbol: 'ULTR', caption: 'Stand united', palette: 'red' },
  'event-school-visit-success': { symbol: 'EGG', caption: 'Playground hero', palette: 'blue' },
  'event-hundredth-fan-success': { symbol: '100', caption: 'Roundabout parade', palette: 'gold' },
  'event-training-drone-success': { symbol: 'DRON', caption: 'Press complete', palette: 'blue' },
  'event-haunted-scoreboard-success': { symbol: '90:00', caption: 'Future prepared', palette: 'grey' },
  'event-community-mural-success': { symbol: 'WALL', caption: 'Moves at dusk', palette: 'violet' },
};

export function eventSuccessMotif(artKey: string): EventSuccessMotif | undefined {
  return EVENT_SUCCESS_MOTIFS[artKey];
}
