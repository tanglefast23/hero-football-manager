# 07 — Chance Events

Events are the game's storyteller. They must feel like little comics: a setup, a choice, a punchline. Powers arrive separately through automatic post-match cutscenes (doc 04).

## System rules

- **Roll**: 18% chance per week during the manage phase; guaranteed at least one event per 8 weeks (event dry-spell timer). These are club-life stories and resource decisions. **They do not award powers.**
- **Format**: an event card — pixel illustration, 2–4 lines of flavor text, 2–3 choice buttons. Choices can be gated (needs a facility, a personality on the roster, or cash).
- **Outcomes**: weighted rolls; weights shift with relevant stats, facilities, and personalities. Outcomes always narrate ("The spider respected the hustle."), never just emit numbers.
- **Risk philosophy**: safe choices give small guaranteed value; unusual choices carry stronger club-culture outcomes and occasional downside. The player should hover over a strange button and grin, without wondering whether declining it forfeits a hero.

## The template event (user's spider, fully specified)

> **A GIANT SPIDER has moved into the clubhouse!** It's wearing a tiny scarf in club colors. The squad is split between screaming and adopting it.

| Choice | Requirements | Outcomes (weighted) |
|---|---|---|
| **Let the squad adopt it** | — | 100%: +5 squad morale; the spider receives a locker and demands extra cones |
| **Call the groundskeeper** | — | 100%: +10 TP; the clubhouse is safe but the tiny scarf remains unexplained |

Awakening math is intentionally absent here. A manager never needs to chase this event, accept a bite, or sacrifice its guaranteed reward to make a hero (doc 04).

## Launch catalog (~30 events, by category)

- **Mystery (rare)**: Giant Spider · Meteor Shard in the Center Circle · Lightning Storm Training · Mysterious Energy Drink Salesman · Abandoned Lab Field Trip · Radioactive Pitch Repaint · A Very Old Boot (cursed?).
- **Club life**: Team BBQ (morale vs. food poisoning) · Prank War (Joker-driven) · Lost Mascot Costume · Kit Clash (fans vote on a new kit) · Rat in the Trophy Cabinet.
- **Media**: Local paper wants a hero exposé (fame + sponsor buzz vs. hero wage ask +10% at renewal) · Viral goal clip (+fans) · Pundit Slams Your Tactics (ignore vs. clap back).
- **Sponsor**: Pop-up sponsor offers (quick cash, awkward objectives) · Sponsor demands your hero does a commercial (cash vs. 1 week condition).
- **Player personal**: Slump (Timid player needs a start or a rest) · Homesick youth · Lottery Win (Greedy player's morale forever changed) · Two players feud (pick a side or team-building drill) · Agent Whispers (poach warning).
- **Medical**: Flu wave (rotate or risk) · Miracle Physio visits (heal one injury instantly for cash).
- **Fan**: Ultras want cheaper tickets · Kid asks your hero to visit school (+fans, +hero morale) · 100th-fan celebration.

Frequency mix per season (~5–7 events): ~2 mystery, ~2 club/player, ~1 media/sponsor, ~1 fan/medical.

## Data-driven schema (content is JSON, not code)

```ts
type GameEvent = {
  id: string; category: 'mystery'|'club'|'media'|'sponsor'|'player'|'medical'|'fan';
  rarity: 'common'|'rare'|'legendary';
  trigger?: { minDivision?: number; requiresFacility?: string; personalityOnRoster?: string };
  art: string; title: string; body: string;
  choices: Array<{
    label: string; requires?: { money?: number; facility?: string };
    outcomes: Array<{ weight: number; effects: Effect[]; text: string }>;
  }>;
};
```

`Effect` is a small closed union (statDelta, injury, money, tp, essence, morale, fans, flag). New events ship as data — cheap post-launch content, and the balance harness can simulate event luck distributions.
