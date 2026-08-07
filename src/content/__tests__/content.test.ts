import { CAREER_MILESTONES } from '../../game';
import { loadLaunchContent, parseLaunchContent } from '../load';
import type { LaunchContent } from '../schemas';

function cloneContent(content: LaunchContent): LaunchContent {
  return JSON.parse(JSON.stringify(content)) as LaunchContent;
}

describe('validated M1 launch content', () => {
  test('loads ten playable clubs with sixteen players each', () => {
    const content = loadLaunchContent();
    const clubs = content.clubs.clubs;

    expect(clubs).toHaveLength(10);
    expect(clubs.flatMap(club => club.players)).toHaveLength(160);

    for (const club of clubs) {
      expect(club.players).toHaveLength(16);
      expect(club.players.filter(player => player.role === 'GK')).toHaveLength(2);
      expect(club.players.filter(player => player.role === 'DEF')).toHaveLength(5);
      expect(club.players.filter(player => player.role === 'MID')).toHaveLength(5);
      expect(club.players.filter(player => player.role === 'FWD')).toHaveLength(4);
      expect(club.startingLineup).toHaveLength(11);
      const playerById = new Map(club.players.map(player => [player.id, player]));
      const lineup = club.startingLineup.map(playerId => playerById.get(playerId));
      expect(lineup.every(Boolean)).toBe(true);
      expect(lineup[0]?.role).toBe('GK');
      expect(lineup.filter(player => player?.role === 'GK')).toHaveLength(1);
      expect(lineup.filter(player => player?.licensed && player.powerId !== null).length)
        .toBeLessThanOrEqual(2);
    }

    const bramble = clubs.find(club => club.id === 'bramble-rovers');
    expect(bramble?.players.filter(player => player.licensed).map(player => player.powerId).sort())
      .toEqual([]);
  });

  test('keeps all IDs, positions, ratings, and references valid', () => {
    const content = loadLaunchContent();
    const clubIds = content.clubs.clubs.map(club => club.id);
    const players = content.clubs.clubs.flatMap(club => club.players);
    const playerIds = players.map(player => player.id);
    const powerIds = new Set(content.powers.powers.map(power => power.id));
    const eventIds = new Set(content.events.events.map(event => event.id));

    expect(new Set(clubIds).size).toBe(clubIds.length);
    expect(new Set(playerIds).size).toBe(playerIds.length);
    // Magnet Touch was cut at M4. m1.13 added five position-friendly powers,
    // m1.14 promotes Gust from the design catalog, leaving three data slots.
    expect(content.powers.powers).toHaveLength(17);
    expect(content.powers.powers.filter(power => power.requiresTarget).map(power => power.id)).toEqual([
      'PORTAL_PASS',
      'DECOY_DOUBLE',
      'FUTURE_SIGHT',
      'SUPER_STRENGTH',
      'WEB_TRAP',
      'ELASTIC_KEEPER',
      'ICE_RINK',
      'SHADOW_MARK',
      'GRAVITY_WELL',
      'GIANT_GK',
      'GUST',
    ]);
    expect(content.powers.powers.filter(power => power.tier === 'starter').length).toBeGreaterThanOrEqual(3);
    expect(content.training.focusDrills).toHaveLength(35);
    expect(content.sponsors.brands).toHaveLength(12);
    expect(content.sponsors.objectives.map(objective => objective.kind)).toEqual([
      'LEAGUE_WINS',
      'LEAGUE_GOALS',
      'LEAGUE_FINISH',
    ]);
    const drillPaths = new Map<string, number[]>();
    for (const drill of content.training.focusDrills) {
      expect(Object.keys(drill.gains)).toHaveLength(1);
      const path = drill.id.replace(/-(ii|iii|iv|v)$/, '');
      drillPaths.set(path, [...(drillPaths.get(path) ?? []), ...Object.values(drill.gains)]);
    }
    // Six paths share the ladder. Keeper Drills is deliberately lower: REF is
    // contested on every opposing shot, so a uniform ladder priced it at roughly
    // 14x the value per TP of every other drill. See
    // docs/superpowers/reports/2026-07-30-real-player-balance-findings.md.
    // Each rung is strictly cheaper per point than the one below: 2.50, 2.14,
    // 1.91, 1.75, 1.64 TP per point against 10/15/21/28/36 TP. Tier II used to
    // match tier I exactly, so the $3,000 upgrade bought no extra throughput.
    expect(Object.fromEntries(drillPaths)).toEqual({
      sprints: [4, 7, 11, 16, 22],
      finishing: [4, 7, 11, 16, 22],
      rondo: [4, 7, 11, 16, 22],
      duels: [4, 7, 11, 16, 22],
      'first-touch': [4, 7, 11, 16, 22],
      circuit: [4, 7, 11, 16, 22],
      // No longer exactly half at every rung — 7 and 11 do not halve — so the
      // display multiplier is 2, 1.75, 1.833, 2, 2 rather than a flat 2.
      'keeper-drills': [2, 4, 6, 8, 11],
    });
    expect(content.events.events).toHaveLength(50);
    expect(new Set(content.events.events.map(event => event.category))).toEqual(new Set([
      'mystery',
      'club',
      'media',
      'sponsor',
      'player',
      'medical',
      'fan',
    ]));
    expect(content.events.events.every(event => event.choices.some(choice => choice.risky))).toBe(true);
    for (const event of content.events.events) {
      for (const choice of event.choices.filter(choice => choice.risky)) {
        expect(choice.outcomes[0].effects).toContainEqual(expect.objectContaining({ type: 'flag', value: true }));
      }
    }
    expect(content.events.events.some(event => event.trigger.repeatable)).toBe(true);
    // M4 requires a bespoke success cutscene for every risky outcome, not a
    // generated "<title>: success!" restatement of the choice the player made.
    const successHeadlines = content.events.events.flatMap(event => event.choices
      .filter(choice => choice.risky)
      .map(choice => ({ event: event.title, headline: choice.outcomes[0].successHeadline })));
    expect(successHeadlines).toHaveLength(50);
    for (const { event, headline } of successHeadlines) {
      expect(headline).toEqual(expect.any(String));
      expect(headline).not.toContain(event);
    }
    expect(new Set(successHeadlines.map(entry => entry.headline)).size).toBe(50);
    expect(content.events.events.some(event => event.trigger.requiresPlayer)).toBe(true);
    expect(content.events.events.some(event => event.trigger.requiredFacility)).toBe(true);
    expect(content.events.events.some(event => event.trigger.requiredPersonality)).toBe(true);
    expect(content.events.events.some(event => event.trigger.requiresHero)).toBe(true);
    expect(content.events.events.some(event => event.choices.some(choice => choice.requires?.minMoney))).toBe(true);
    expect(content.events.events.some(event => event.choices.some(choice => (
      choice.outcomes.some(outcome => outcome.nextEventId !== undefined)
    )))).toBe(true);

    for (const player of players) {
      expect(['GK', 'DEF', 'MID', 'FWD']).toContain(player.role);
      for (const rating of Object.values(player.ratings)) {
        expect(Number.isInteger(rating)).toBe(true);
        expect(rating).toBeGreaterThanOrEqual(1);
        expect(rating).toBeLessThanOrEqual(99);
      }
      if (player.powerId !== null) expect(powerIds.has(player.powerId)).toBe(true);
    }
    expect(players.find(player => player.name === 'Rex Bould')).toMatchObject({
      powerId: null,
      licensed: false,
      onHeroWage: false,
    });

    for (const club of content.clubs.clubs) {
      const rosterIds = new Set(club.players.map(player => player.id));
      expect(club.startingLineup.every(playerId => rosterIds.has(playerId))).toBe(true);
    }

    for (const event of content.events.events) {
      for (const choice of event.choices) {
        for (const outcome of choice.outcomes) {
          if (outcome.nextEventId !== undefined) {
            expect(eventIds.has(outcome.nextEventId)).toBe(true);
          }
        }
      }
    }
  });

  test('ships a recognition story for every career milestone the engine records', () => {
    const events = loadLaunchContent().events.events;
    const milestoneStories = events.filter(
      event => event.trigger.requiredFlag?.startsWith('milestone:') === true,
    );

    expect(milestoneStories.map(event => event.id)).toEqual([
      'milestone-first-win',
      'milestone-first-hero-goal',
      'milestone-statement-win',
      'milestone-unbeaten-run',
      'milestone-first-cup-win',
      'milestone-crowd-thousand',
      'milestone-promotion-push',
    ]);
    for (const milestone of CAREER_MILESTONES) {
      const story = events.find(event => event.id === milestone.eventId);
      expect(story?.trigger.requiredFlag).toBe(milestone.flag);
      // Recognition arrives from Season 1 onward, whenever the club earns it.
      expect(story?.trigger.season).toBe(1);
    }
  });

  test('threads authored follow-ups and keeps a run of good news in the deck', () => {
    const events = loadLaunchContent().events.events;
    const chains = events.flatMap(event => event.choices.flatMap(choice => choice.outcomes.flatMap(
      outcome => outcome.nextEventId === undefined ? [] : [[event.id, outcome.nextEventId]],
    )));

    expect(chains).toEqual(expect.arrayContaining([
      ['hundredth-fan', 'community-mural'],
      ['rival-bid-arrives', 'rival-bid-deadline-day'],
      ['leaking-stand-roof', 'west-stand-reopening'],
    ]));
    // Every authored thread step is reachable by the flag its opener produces,
    // so a chain broken by a retired event still resolves from the weekly deck.
    for (const followUpId of ['rival-bid-deadline-day', 'west-stand-reopening', 'terrace-choir-anthem']) {
      expect(events.find(event => event.id === followUpId)?.trigger.requiredFlag)
        .toEqual(expect.any(String));
    }
    // Good news the player can look forward to: stories whose every outcome
    // leaves the club no worse off than it started.
    const goodNews = events.filter(event => event.choices.every(choice => choice.outcomes.every(
      outcome => outcome.effects.every(effect => (
        effect.type === 'flag' || effect.type === 'injury'
          ? effect.type === 'flag'
          : effect.type === 'statDelta' ? effect.amount >= 0 : effect.amount >= 0
      )),
    )));
    expect(goodNews.length).toBeGreaterThanOrEqual(12);
  });

  test('loads byte-identically and does not share mutable parsed objects', () => {
    const first = loadLaunchContent();
    const second = loadLaunchContent();

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(first).not.toBe(second);
    expect(first.clubs.clubs[0]).not.toBe(second.clubs.clubs[0]);

    first.clubs.clubs[0].name = 'Changed parsed copy';
    expect(loadLaunchContent().clubs.clubs[0].name).toBe('Bramble Rovers');
  });

  test('rejects wrong counts, duplicate IDs, bad positions, and invalid ratings', () => {
    const tooFewClubs = cloneContent(loadLaunchContent());
    tooFewClubs.clubs.clubs.pop();
    expect(() => parseLaunchContent(tooFewClubs)).toThrow();

    const shortRoster = cloneContent(loadLaunchContent());
    shortRoster.clubs.clubs[0].players.pop();
    expect(() => parseLaunchContent(shortRoster)).toThrow();

    const duplicatePlayer = cloneContent(loadLaunchContent());
    duplicatePlayer.clubs.clubs[0].players[1].id = duplicatePlayer.clubs.clubs[0].players[0].id;
    expect(() => parseLaunchContent(duplicatePlayer)).toThrow(/player IDs must be unique/);

    const badRole = cloneContent(loadLaunchContent());
    (badRole.clubs.clubs[0].players[1] as unknown as { role: string }).role = 'COACH';
    expect(() => parseLaunchContent(badRole)).toThrow();

    const badRating = cloneContent(loadLaunchContent());
    badRating.clubs.clubs[0].players[1].ratings.pac = 100;
    expect(() => parseLaunchContent(badRating)).toThrow();
  });

  test('rejects multi-stat drills and malformed tier paths at runtime', () => {
    const multiStat = cloneContent(loadLaunchContent());
    multiStat.training.focusDrills[0].gains.sho = 3;
    expect(() => parseLaunchContent(multiStat)).toThrow(/exactly one attribute/);

    const wrongAttribute = cloneContent(loadLaunchContent());
    wrongAttribute.training.focusDrills[0].gains = { sho: 4 };
    expect(() => parseLaunchContent(wrongAttribute)).toThrow(/must grant exactly \+4 PAC/);

    const wrongTierAmount = cloneContent(loadLaunchContent());
    wrongTierAmount.training.focusDrills[1].gains.pac = 10;
    expect(() => parseLaunchContent(wrongTierAmount)).toThrow(/must grant exactly \+7 PAC/);

    const unknownTier = cloneContent(loadLaunchContent());
    unknownTier.training.focusDrills[2].id = 'sprints-vi';
    expect(() => parseLaunchContent(unknownTier)).toThrow(/seven five-tier drill paths/);
  });

  test('rejects sponsor terms or copy that drift from the approved offer contract', () => {
    const wrongTradeOff = cloneContent(loadLaunchContent());
    wrongTradeOff.sponsors.profiles.BOLD.monthlyPercent = 110;
    expect(() => parseLaunchContent(wrongTradeOff)).toThrow(/approved trade-off/);

    const duplicateBrand = cloneContent(loadLaunchContent());
    duplicateBrand.sponsors.brands[1].id = duplicateBrand.sponsors.brands[0].id;
    expect(() => parseLaunchContent(duplicateBrand)).toThrow(/sponsor brand IDs must be unique/);

    const unboundedCopy = cloneContent(loadLaunchContent());
    unboundedCopy.sponsors.brands[0].name = 'A sponsor name that cannot fit safely';
    expect(() => parseLaunchContent(unboundedCopy)).toThrow();

    const backwardsDifficulty = cloneContent(loadLaunchContent());
    backwardsDifficulty.sponsors.objectives[0].targets.HARD = 1;
    expect(() => parseLaunchContent(backwardsDifficulty)).toThrow(/not ordered correctly/);
  });

  test('rejects broken lineup, event-chain, and power references', () => {
    const badLineup = cloneContent(loadLaunchContent());
    badLineup.clubs.clubs[0].startingLineup[1] = 'missing-player';
    expect(() => parseLaunchContent(badLineup)).toThrow(/unknown lineup player ID/);

    const badEventLink = cloneContent(loadLaunchContent());
    badEventLink.events.events[0].choices[0].outcomes[0].nextEventId = 'missing-event';
    expect(() => parseLaunchContent(badEventLink)).toThrow(/unknown next event ID/);

    const missingPower = cloneContent(loadLaunchContent());
    missingPower.powers.powers[1].id = 'SUPER_SPEED';
    expect(() => parseLaunchContent(missingPower)).toThrow(/power IDs must be unique|unknown power ID/);

    const ambiguousRiskyOutcome = cloneContent(loadLaunchContent());
    ambiguousRiskyOutcome.events.events[0].choices[0].outcomes = [{
      ...ambiguousRiskyOutcome.events.events[0].choices[0].outcomes[0],
      weight: 100,
    }];
    expect(() => parseLaunchContent(ambiguousRiskyOutcome)).toThrow(/risky event choices must define success first/);

    const unmarkedRiskySuccess = cloneContent(loadLaunchContent());
    unmarkedRiskySuccess.events.events[0].choices[0].outcomes[0].effects =
      unmarkedRiskySuccess.events.events[0].choices[0].outcomes[0].effects.filter(
        effect => effect.type !== 'flag',
      );
    expect(() => parseLaunchContent(unmarkedRiskySuccess)).toThrow(/mark its first outcome as the authored success/);
  });

  test('captures the locked M1 training and post-match awakening tuning', () => {
    const content = loadLaunchContent();

    expect(content.training.focusDrills).toContainEqual(expect.objectContaining({
      id: 'circuit',
      name: 'Circuit 1',
      gains: { sta: 4 },
    }));
    expect(content.events.tuning).toEqual({
      weeklyChancePercent: 18,
      guaranteeAfterDryWeeks: 6,
    });
    expect(content.powers.awakening).toEqual({
      postMatchChancePercent: 10,
      secondInSeasonChancePercent: 2,
      maxPerSeason: 2,
      minimumMatchesBetween: 3,
    });
    expect(content.onboarding.limp).toContain('{name}');
    expect(content.onboarding.triggers).toHaveLength(15);
    expect(new Set(content.onboarding.triggers.map(trigger => trigger.visual)).size).toBe(15);
    expect(content.onboarding.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'glowing-caterpillar', callout: 'BITE CONFIRMED' }),
      expect.objectContaining({
        id: 'strong-man-strong-drink',
        title: 'STRONG MAN STRONG DRINK.',
        callout: 'STRONG MAN STRONG DRINK',
      }),
    ]));
    expect(content.onboarding.triggers.map(trigger => trigger.id)).not.toEqual(expect.arrayContaining([
      'mystic-orange-slice',
      'forbidden-energy-gel',
      'var-future-flash',
    ]));
    expect(content.onboarding.powers.map(power => power.powerId).sort()).toEqual([
      'BLINK_RUN',
      'DECOY_DOUBLE',
      'ELASTIC_KEEPER',
      'FIRE_TORCH',
      'FUTURE_SIGHT',
      'GIANT_GK',
      'GRAVITY_WELL',
      'GUST',
      'ICE_RINK',
      'PHASE_RUN',
      'PORTAL_PASS',
      'RALLY_CRY',
      'SHADOW_MARK',
      'SUPER_SPEED',
      'SUPER_STRENGTH',
      'THUNDER_STRIKE',
      'WEB_TRAP',
    ]);
    expect(content.onboarding.powers.every(power =>
      power.omen.includes('{name}') && power.reveal.includes('{name}'))).toBe(true);
    expect(content.assistantGuide.assistant).toEqual({
      name: 'Bert Rudge',
      role: 'Assistant Manager',
      portraitArchetype: 'GAFFER',
    });
    expect(content.assistantGuide.sequences.map(sequence => sequence.id)).toEqual([
      'management-intro',
      'desk-intro',
      'head-coach-market',
      'head-coach-hire',
      'coaching-office',
      'assistant-coach-hire',
      'facility-placement',
      'facility-upgrade',
      'facility-adjacency',
      'scout-mission',
      'scout-report',
      'roster-cap',
      'transfer-list',
      'transfer-bid',
      'transfer-negotiation',
      'youth-intake',
      'national-cup',
      'division-leaders',
      'sponsor-desk',
      'sponsor-desk-continuity',
      'sponsor-buzz',
      'first-injury',
      'first-emergency-loan',
      'first-transfer-request',
      'retirement',
      'club-legacy',
      'board-ultimatum',
      'board-protection',
      'player-requests',
    ]);
    const managementIntroPages = content.assistantGuide.sequences
      .find(sequence => sequence.id === 'management-intro')
      ?.pages;
    expect(managementIntroPages).toHaveLength(3);
    expect(managementIntroPages?.find(page => page.focus === 'navigation')).toMatchObject({
      buttonLabel: 'Got it!',
      navItems: [
        { tab: 'HOME', detail: "Today's work." },
        { tab: 'SQUAD', detail: 'Team and training.' },
        // "grounds" keeps the line short enough that the narrow cue chip never
        // breaks it mid-word ("FACILITIE S.").
        { tab: 'CLUB', detail: 'Wages and grounds.' },
        { tab: 'MARKET', detail: 'Scout, hire and fire.' },
        { tab: 'LEAGUE', detail: 'Leagues and rivals.' },
      ],
    });
    expect(managementIntroPages?.some(page => page.title === 'Read it first')).toBe(false);
    const deskIntroPages = content.assistantGuide.sequences
      .find(sequence => sequence.id === 'desk-intro')
      ?.pages;
    // One page. The dropped opener counted the player's inbox for them — at the
    // top of the week, before they could act, with a hardcoded "one job" that
    // was wrong the moment two cards were waiting behind Bert.
    expect(deskIntroPages).toHaveLength(1);
    expect(deskIntroPages?.[0]).toMatchObject({
      title: 'One week to kick-off',
      focus: 'assistant',
      buttonLabel: 'Right you are.',
    });
    expect(deskIntroPages?.some(page => page.body.some(line => line.includes('inbox')))).toBe(false);
    expect(content.assistantGuide.sequences
      .find(sequence => sequence.id === 'head-coach-market')
      ?.inbox?.title).toBe('HIRE A COACH');
    const m2Sequences = content.assistantGuide.sequences.slice(2);
    expect(m2Sequences).toHaveLength(27);
    expect(m2Sequences.every(sequence => (
      sequence.inbox !== undefined
      && sequence.destination !== undefined
      && (sequence.id === 'sponsor-desk-continuity'
        ? sequence.pages.every(page => page.objective === undefined)
        : sequence.pages.some(page => page.objective !== undefined))
    ))).toBe(true);
    const conciseBriefings = content.assistantGuide.sequences.slice(1)
      .flatMap(sequence => sequence.pages);
    expect(conciseBriefings.every(page => page.body.length === 1)).toBe(true);
    // 200, raised from 160 for the Hero Cup briefing, which is the owner's
    // own words at 199 characters. The cap exists so a briefing stays one
    // readable card, not to hold any particular number.
    expect(conciseBriefings.every(page => page.body[0].length <= 200)).toBe(true);
    expect(content.assistantGuide.sequences
      .find(sequence => sequence.id === 'assistant-coach-hire')).toMatchObject({
        destination: 'coach-market',
        pages: [{ focus: 'assistant-coach-hire', objective: 'HIRE AN ASSISTANT COACH.' }],
      });
    expect(content.assistantGuide.sequences
      .find(sequence => sequence.id === 'first-injury')).toMatchObject({
        destination: 'squad',
        pages: [{ focus: 'injury-lineup' }],
      });
    expect(content.assistantGuide.sequences
      .find(sequence => sequence.id === 'first-emergency-loan')).toMatchObject({
        destination: 'club-finances',
        pages: [{
          focus: 'emergency-loan',
          body: [
            "This is the club's only automatic emergency loan. Repayments begin next season. Fan Shops and Stadium Stands make money, and you can build up to three of each. Every other facility is limited to one.",
          ],
        }],
      });
    expect(content.assistantGuide.sequences
      .find(sequence => sequence.id === 'first-transfer-request')).toMatchObject({
        destination: 'squad',
        pages: [{ focus: 'transfer-request' }],
      });
    expect(content.assistantGuide.sequences
      .find(sequence => sequence.id === 'facility-placement')
      ?.pages[0]).toMatchObject({
        title: 'Put down the Training Pitch',
        objective: 'BUILD YOUR TRAINING PITCH.',
      });
    expect(content.assistantGuide.sequences
      .find(sequence => sequence.id === 'facility-upgrade')
      ?.pages[0].body[0]).toContain('current level stays active until construction finishes');
    expect(content.assistantGuide.sequences
      .find(sequence => sequence.id === 'board-protection')).toMatchObject({
        destination: 'club-finances',
        pages: [{ focus: 'board-protection', objective: 'PROTECT ONE PLAYER.' }],
      });
    expect(content.assistantGuide.sequences
      .find(sequence => sequence.id === 'sponsor-desk')).toMatchObject({
        inbox: {
          title: 'SPONSORS ARE CALLING',
          detail: "Moving up the divisions has put the club on bigger companies' radar.",
        },
        destination: 'club-finances',
        pages: [{
          focus: 'sponsor-desk',
          objective: 'REVIEW THE SPONSOR OFFERS.',
          body: [
            // He names the shape of the choice, not just that there is one: all
            // three pay monthly, and the target is what separates them.
            "Three want the slot, boss. All pay monthly, but each carries a season target: Steady's is easy and pays little, Bold's is hard and pays big. Read the target before the money.",
          ],
        }],
      });
    expect(content.assistantGuide.sequences
      .find(sequence => sequence.id === 'sponsor-desk-continuity')).toMatchObject({
        destination: 'club-finances',
        pages: [{
          focus: 'sponsor-summary',
          body: [
            'The club has already moved up in the divisions, boss. Your current sponsor income carries on this season. The new offers arrive next pre-season.',
          ],
        }],
      });
    expect(content.assistantGuide.sequences
      .find(sequence => sequence.id === 'sponsor-buzz')).toMatchObject({
        destination: 'club-finances',
        pages: [{
          focus: 'sponsor-buzz',
          objective: 'REVIEW THE BUZZ METER.',
          body: [
            "We're famous enough to have a proper social media following now. Goals, wins and hero moments build Buzz. It cashes out in Week 15 and Week 30 — a full meter pays a month's sponsor money on top.",
          ],
        }],
      });
  });

  test('keeps the opening sequence short and saves the Training Pitch explanation for its task', () => {
    const intro = loadLaunchContent().assistantGuide.sequences
      .find(sequence => sequence.id === 'management-intro');
    const bodies = intro?.pages.flatMap(page => page.body) ?? [];

    expect(bodies.some(line => line.includes('Training Pitch'))).toBe(false);
  });

  test('explains local advertising in the club glossary', () => {
    const club = loadLaunchContent().glossary.categories
      .find(category => category.id === 'club');
    const entry = club?.entries.find(term => term.term === 'Local advertising');
    expect(entry?.definition).toContain('every fourth week');
    expect(entry?.definition).toContain('Division 4');

    const money = club?.entries.find(term => term.term === 'Money');
    expect(money?.definition).toContain('advertising');
  });
});

describe('event outcome ids', () => {
  test('every outcome carries an id, unique within its event', () => {
    for (const event of loadLaunchContent().events.events) {
      const paths = event.choices.flatMap(choice =>
        choice.outcomes.map(outcome => `${choice.id}.${outcome.id}`));
      expect({ event: event.id, missing: paths.filter(p => p.endsWith('.undefined')) })
        .toEqual({ event: event.id, missing: [] });
      expect({ event: event.id, count: new Set(paths).size })
        .toEqual({ event: event.id, count: paths.length });
    }
  });

  test('a risky choice names its two branches by role, not by position', () => {
    for (const event of loadLaunchContent().events.events) {
      for (const choice of event.choices.filter(c => c.risky)) {
        expect({ event: event.id, ids: choice.outcomes.map(o => o.id) })
          .toEqual({ event: event.id, ids: ['success', 'setback'] });
      }
    }
  });
});
