# 07 — Chance Events

Events are the game's storyteller. They must feel like little comics: a setup, a choice, a punchline. Powers arrive separately through automatic post-match cutscenes (doc 04).

## System rules

- **Roll**: 18% chance per week during the manage phase; guaranteed at least one event per 6 weeks (event dry-spell timer). The guarantee counts only eligible quiet weeks — a week whose desk still holds unresolved work returns before the clock ticks. When season-stamped history exists, an unseen random-deck story gets double its normal rarity weight. A repeatable story needs one full intervening season before it can return. History-less older saves use normal weights and no repeat cooldown until they record new history. These are club-life stories and resource decisions. **They do not award powers.**
- **Format**: an event card — pixel illustration, 2–4 lines of flavor text, 2–3 choice buttons. Choices can be gated (needs a facility, a personality on the roster, or cash). Risky choices use the light pastel-red decision surface, not the pitch showing through.
- **Outcomes**: weighted rolls; weights shift with relevant stats, facilities, and personalities. Every choice opens a distinct result screen that says what happened. A risky miss explicitly says no bonus was earned; a success celebrates, names each reward, and pairs it with a small canonical 16×16 pixel-art object and staggered micro-animation. Outcomes always narrate what happened; they never emit only numbers.
- **Risk philosophy**: safe choices give small guaranteed value; unusual choices carry stronger club-culture outcomes and occasional downside. The player should hover over a strange button and grin, without wondering whether declining it forfeits a hero.

Awakening math is intentionally absent here. A manager never needs to chase an event or sacrifice its guaranteed reward to make a hero (doc 04).

## Launch catalog (54 events in `content/events.json`)

The JSON catalog is canonical; the counts below are pinned by content and Harness tests.

| Category  | Events |
| --------- | -----: |
| Club      |     17 |
| Fan       |      7 |
| Media     |      4 |
| Player    |     25 |
| Sponsor   |      1 |
| **Total** | **54** |

Targeting cuts across those categories: 27 stories ask for a player, 9 ask for a coach,
and 8 ask for an operational facility. The manager chooses the subject before making the
safe-or-risky call. Candidate rules are shared by the weekly offer, production screen,
resolution path, save recovery, browser Dev Harness, and long-career audit:

- a player must belong to the user's club and must be a goalkeeper when the story says so;
- a coach must be employed, must match an authored head/assistant restriction, and cannot
  be selected for a specialty they already hold;
- a facility must match an authored type and be finished and operational;
- a targeted story with no legal candidate stays out of the weekly deck.

Six events open authored second chapters. A targeted second chapter inherits and locks the
exact player, coach, or facility from its opener. If that subject has disappeared or is no
longer legal, the sequel is skipped without applying effects; it is never silently recast.
Authored follow-ups do not appear independently in the random deck.

The visible Dev Harness exposes the full catalog at `#/dev/career-events/all`, plus stable
`target-player`, `target-coach`, `target-facility`, and `two-part` lanes. Existing category
bookmarks remain valid. Harness choices use the same target, resolution, and continuation
functions as the real game.

Frequency mix per season (~5–7 events): ~2 mystery, ~2 club/player, ~1 media/sponsor, ~1 fan/medical.

## Data-driven schema (content is JSON, not code)

```ts
type GameEvent = {
  id: string;
  category:
    'mystery' | 'club' | 'media' | 'sponsor' | 'player' | 'medical' | 'fan';
  rarity: 'common' | 'rare' | 'legendary';
  trigger: {
    minDivision?: number;
    requiresPlayer?: true;
    requiresPlayerRole?: 'GK';
    requiresCoach?: true;
    requiresCoachRole?: 'HEAD' | 'ASSISTANT';
    requiresBothCoaches?: true;
    requiresFacility?: FacilityType[];
    personalityOnRoster?: string;
  };
  art: string;
  title: string;
  body: string;
  choices: Array<{
    label: string;
    requires?: { money?: number; facility?: string };
    outcomes: Array<{
      weight: number;
      effects: Effect[];
      text: string;
      nextEventId?: string;
    }>;
  }>;
};
```

`Effect` is a closed, validated union covering club resources, targeted player changes,
coach boosts/specialties, facility output boosts and closures, 2–6 week training changes,
squad morale, and story flags. Rare and legendary events cannot repeat. New events
still ship as data, while one shared application resolver applies every effect consistently.

Direct story money scales with division minimums and maximums. A major financial risk may
take up to 10% of current cash, but cannot drive cash below zero. Selected player and Bert
callbacks can appear later as one short speech bubble. Callback timing, speaker, and copy
survive saves and season boundaries.

An authored transfer offer uses the same sale transaction as the market: the selected
player changes clubs, both clubs' cash changes, wages and lineup are repaired, and the
ledger records one transfer. The choice preview and result name both consequences, for
example `+$2,600` and `Lose Gio Marsh`; adding money without moving the player is invalid
content.

All event copy follows a plain-language rule: the setup says what is happening, each button
says what the manager will do, and each result says what happened. Football-industry
shorthand is avoided when everyday words are clearer. Every changed event string is kept in
sync across English, German, Spanish, French, Indonesian, Brazilian Portuguese, and
Vietnamese.

Risky coach and facility choices use half their original success chance, rounded down when
needed (`65%` becomes `32%`, `55%` becomes `27%`); the remaining weight goes to the setback.
Their safe choices, rewards, eligibility, and RNG order are unchanged, and player-targeted
event odds are unchanged.
