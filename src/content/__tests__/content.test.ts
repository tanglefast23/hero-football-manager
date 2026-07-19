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
    expect(content.powers.powers).toHaveLength(3);
    expect(content.powers.powers.every(power => power.tier === 'starter')).toBe(true);
    expect(content.training.focusDrills).toHaveLength(6);

    for (const player of players) {
      expect(['GK', 'DEF', 'MID', 'FWD']).toContain(player.role);
      for (const rating of Object.values(player.ratings)) {
        expect(Number.isInteger(rating)).toBe(true);
        expect(rating).toBeGreaterThanOrEqual(1);
        expect(rating).toBeLessThanOrEqual(99);
      }
      if (player.powerId !== null) expect(powerIds.has(player.powerId)).toBe(true);
    }

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
      'FIRE_TORCH',
      'SUPER_SPEED',
      'SUPER_STRENGTH',
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
      'squad-intro',
      'desk-intro',
    ]);
    expect(content.assistantGuide.sequences
      .find(sequence => sequence.id === 'management-intro')
      ?.pages.find(page => page.focus === 'navigation')
      ?.navItems).toHaveLength(5);
  });
});
