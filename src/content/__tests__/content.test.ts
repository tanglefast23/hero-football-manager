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
    expect(content.training.focusDrills).toHaveLength(21);
    const drillPaths = new Map<string, number[]>();
    for (const drill of content.training.focusDrills) {
      expect(Object.keys(drill.gains)).toHaveLength(1);
      const path = drill.id.replace(/-(ii|iii)$/, '');
      drillPaths.set(path, [...(drillPaths.get(path) ?? []), ...Object.values(drill.gains)]);
    }
    expect([...drillPaths.values()]).toEqual(Array.from({ length: 7 }, () => [3, 5, 8]));
    expect(content.events.events).toHaveLength(30);
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
    expect(successHeadlines).toHaveLength(30);
    for (const { event, headline } of successHeadlines) {
      expect(headline).toEqual(expect.any(String));
      expect(headline).not.toContain(event);
    }
    expect(new Set(successHeadlines.map(entry => entry.headline)).size).toBe(30);
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
    wrongAttribute.training.focusDrills[0].gains = { sho: 3 };
    expect(() => parseLaunchContent(wrongAttribute)).toThrow(/must grant exactly \+3 PAC/);

    const wrongTierAmount = cloneContent(loadLaunchContent());
    wrongTierAmount.training.focusDrills[1].gains.pac = 8;
    expect(() => parseLaunchContent(wrongTierAmount)).toThrow(/must grant exactly \+5 PAC/);

    const unknownTier = cloneContent(loadLaunchContent());
    unknownTier.training.focusDrills[2].id = 'sprints-iv';
    expect(() => parseLaunchContent(unknownTier)).toThrow(/seven I\/II\/III drill paths/);
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

    expect(content.training.maxFocusDrillsPerWeek).toBe(3);
    expect(content.training.baseConditioning).toMatchObject({ moneyCost: 0, tpCost: 0 });
    expect(content.events.tuning).toEqual({
      weeklyChancePercent: 18,
      guaranteeAfterDryWeeks: 8,
    });
    expect(content.powers.awakening).toEqual({
      postMatchChancePercent: 10,
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
      'first-injury',
      'first-emergency-loan',
      'first-transfer-request',
      'retirement',
      'club-legacy',
      'board-ultimatum',
      'board-protection',
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
    expect(content.assistantGuide.sequences
      .find(sequence => sequence.id === 'desk-intro')
      ?.pages[0]).toMatchObject({
        title: 'Back to your inbox',
        body: [
          "You've still got one job waiting in your inbox.",
        ],
        focus: 'assistant',
        buttonLabel: 'Got it.',
      });
    expect(content.assistantGuide.sequences
      .find(sequence => sequence.id === 'head-coach-market')
      ?.inbox?.title).toBe('HIRE A COACH');
    const m2Sequences = content.assistantGuide.sequences.slice(2);
    expect(m2Sequences).toHaveLength(22);
    expect(m2Sequences.every(sequence => (
      sequence.inbox !== undefined
      && sequence.destination !== undefined
      && sequence.pages.some(page => page.objective !== undefined)
    ))).toBe(true);
    const conciseBriefings = content.assistantGuide.sequences.slice(1)
      .flatMap(sequence => sequence.pages);
    expect(conciseBriefings.every(page => page.body.length === 1)).toBe(true);
    expect(conciseBriefings.every(page => page.body[0].length <= 160)).toBe(true);
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
        pages: [{ focus: 'emergency-loan' }],
      });
    expect(content.assistantGuide.sequences
      .find(sequence => sequence.id === 'first-transfer-request')).toMatchObject({
        destination: 'squad',
        pages: [{ focus: 'transfer-request' }],
      });
    expect(content.assistantGuide.sequences
      .find(sequence => sequence.id === 'facility-placement')
      ?.pages[0].body[0]).toContain('opens after construction');
    expect(content.assistantGuide.sequences
      .find(sequence => sequence.id === 'facility-upgrade')
      ?.pages[0].body[0]).toContain('current level stays active until construction finishes');
    expect(content.assistantGuide.sequences
      .find(sequence => sequence.id === 'board-protection')).toMatchObject({
        destination: 'club-finances',
        pages: [{ focus: 'board-protection', objective: 'PROTECT ONE PLAYER.' }],
      });
  });
});
