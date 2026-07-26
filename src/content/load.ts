import assistantGuideJson from '../../content/assistant-guide.json';
import clubsJson from '../../content/clubs.json';
import eventsJson from '../../content/events.json';
import glossaryJson from '../../content/glossary.json';
import onboardingJson from '../../content/onboarding.json';
import powersJson from '../../content/powers.json';
import trainingJson from '../../content/training.json';
import { LaunchContentSchema, type LaunchContent } from './schemas';

export function parseLaunchContent(input: unknown): LaunchContent {
  return LaunchContentSchema.parse(input);
}

/**
 * Parsed once and shared: the zod pass over ~208KB of catalog JSON costs
 * 40-80ms in Node (several hundred ms on Hermes), and three call sites run
 * before first paint. The catalogs are immutable by contract — nothing may
 * mutate the returned object.
 */
let cachedLaunchContent: LaunchContent | undefined;

export function loadLaunchContent(): LaunchContent {
  cachedLaunchContent ??= parseLaunchContent({
    assistantGuide: assistantGuideJson,
    clubs: clubsJson,
    glossary: glossaryJson,
    onboarding: onboardingJson,
    powers: powersJson,
    training: trainingJson,
    events: eventsJson,
  });
  return cachedLaunchContent;
}
