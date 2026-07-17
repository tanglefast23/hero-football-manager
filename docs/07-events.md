# 07 — Chance Events

Events are the game's storyteller and the primary superpower faucet. They must feel like little comics: a setup, a choice, a punchline.

## System rules

- **Roll**: 18% chance per week during the manage phase; guaranteed at least one event per 8 weeks (pity timer). Taking risky choices raises the weight of future **mystery** events (the game notices you're a gambler). Big beats are scripted: the trialist demo in Match 1, the first permanent awakening at Week 3, and a guaranteed second-hero opportunity chain before Season 1 ends.
- **Format**: an event card — pixel illustration, 2–4 lines of flavor text, 2–3 choice buttons. Choices can be gated (needs a facility, a personality on the roster, or cash).
- **Outcomes**: weighted rolls; weights shift with relevant stats, facilities, and personalities. Outcomes always narrate ("The spider respected the hustle."), never just emit numbers.
- **Risk philosophy**: safe choices give small guaranteed value; risky choices carry the good stuff (stat jumps, Hero Essence, awakenings) *and* real downside (injuries, stat loss, cash). The player should hover over risky buttons and grin.

## The template event (user's spider, fully specified)

> **A GIANT SPIDER has moved into the clubhouse!** It's wearing a tiny scarf in club colors. The squad is split between screaming and adopting it.

| Choice | Requirements | Outcomes (weighted) |
|---|---|---|
| **Approach it** (pick a player) | — | 30% nothing, +5 squad morale · 25% +2 random stat (adrenaline) · 20% bitten: injured 2 wks · 15% bitten: −2 STA for the season · **8% POWER AWAKENING** · 2% it just wants tickets: +500 fans |
| **Squash it** | — | 100%: +5 morale, +10 TP, the Joker on your squad is inconsolable (−5 their morale) |
| **Call the scientist** | Hero Lab built · 2,000 | Awakening odds double (16%), injury odds halve; 10% the scientist bills you again (−2,000) |

Honest math: base odds alone (~2 mystery events/season × 8%) would give ~1 awakening per 6 seasons — far too slow. The **awakening pity counter** closes the gap: every risky choice that doesn't awaken adds +6% to the next awakening roll (persists across events, resets on awakening), and risk-taking raises mystery-event frequency. Measured cadence target: ~1 per 1.5–2 risk-taking seasons, asserted in the balance harness with the full event distribution simulated (doc 04, doc 09).

## Launch catalog (~30 events, by category)

- **Mystery (awakening-capable, rare)**: Giant Spider · Meteor Shard in the Center Circle · Lightning Storm Training · Mysterious Energy Drink Salesman · Abandoned Lab Field Trip · Radioactive Pitch Repaint · A Very Old Boot (cursed?).
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

`Effect` is a small closed union (statDelta, injury, money, tp, essence, morale, fans, awakenPower, flag). New events ship as data — cheap post-launch content, and the balance harness can simulate event luck distributions.
