import assistantGuideJson from '../../content/assistant-guide.json';
import awardCeremonyLinesJson from '../../content/award-ceremony-lines.json';
import agentFinalLinesJson from '../../content/agent-final-lines.json';
import fulltimeBlameLinesJson from '../../content/fulltime-blame-lines.json';
import fulltimeCoachLinesJson from '../../content/fulltime-coach-lines.json';
import clubsJson from '../../content/clubs.json';
import eventsJson from '../../content/events.json';
import glossaryJson from '../../content/glossary.json';
import onboardingJson from '../../content/onboarding.json';
import playerRequestsJson from '../../content/player-requests.json';
import powersJson from '../../content/powers.json';
import rivalHeroIntrosJson from '../../content/rival-hero-intros.json';
import sponsorsJson from '../../content/sponsors.json';
import tipsJson from '../../content/tips.json';
import trainingJson from '../../content/training.json';
import { LaunchContentSchema, type LaunchContent } from './schemas';

export function parseLaunchContent(input: unknown): LaunchContent {
  return LaunchContentSchema.parse(input);
}

/**
 * Parsed once: the zod pass over ~208KB of catalog JSON costs 40-80ms in Node
 * (several hundred ms on Hermes), and three call sites run before first paint.
 *
 * The parse is what is cached, not the object. Handing every caller the same
 * instance made one caller's mutation everyone's — a corruption that outlives
 * the mutating screen and cannot be traced back to it — so each call still gets
 * its own copy. "Immutable by contract" is not a guarantee when the contract is
 * a comment, and the copy costs a couple of milliseconds against the 40-80ms it
 * saves. The round trip is safe because the source is JSON: no dates, maps,
 * classes or undefined survive `parseLaunchContent` to be lost by it.
 */
let cachedLaunchContent: LaunchContent | undefined;

export function loadLaunchContent(): LaunchContent {
  cachedLaunchContent ??= parseLaunchContent({
    assistantGuide: assistantGuideJson,
    awardCeremonyLines: awardCeremonyLinesJson,
    fulltimeBlameLines: fulltimeBlameLinesJson,
    agentFinalLines: agentFinalLinesJson,
    fulltimeCoachLines: fulltimeCoachLinesJson,
    clubs: clubsJson,
    glossary: glossaryJson,
    onboarding: onboardingJson,
    playerRequests: playerRequestsJson,
    powers: powersJson,
    rivalHeroIntros: rivalHeroIntrosJson,
    sponsors: sponsorsJson,
    tips: tipsJson,
    training: trainingJson,
    events: eventsJson,
  });
  return JSON.parse(JSON.stringify(cachedLaunchContent)) as LaunchContent;
}
