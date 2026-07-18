import clubsJson from '../../content/clubs.json';
import eventsJson from '../../content/events.json';
import onboardingJson from '../../content/onboarding.json';
import powersJson from '../../content/powers.json';
import trainingJson from '../../content/training.json';
import {
  ClubCatalogSchema,
  EventCatalogSchema,
  LaunchContentSchema,
  OnboardingContentSchema,
  PowerCatalogSchema,
  TrainingCatalogSchema,
  type ClubCatalog,
  type EventCatalog,
  type LaunchContent,
  type OnboardingContent,
  type PowerCatalog,
  type TrainingCatalog,
} from './schemas';

export function parseClubCatalog(input: unknown): ClubCatalog {
  return ClubCatalogSchema.parse(input);
}

export function parsePowerCatalog(input: unknown): PowerCatalog {
  return PowerCatalogSchema.parse(input);
}

export function parseTrainingCatalog(input: unknown): TrainingCatalog {
  return TrainingCatalogSchema.parse(input);
}

export function parseEventCatalog(input: unknown): EventCatalog {
  return EventCatalogSchema.parse(input);
}

export function parseOnboardingContent(input: unknown): OnboardingContent {
  return OnboardingContentSchema.parse(input);
}

export function parseLaunchContent(input: unknown): LaunchContent {
  return LaunchContentSchema.parse(input);
}

export function loadLaunchContent(): LaunchContent {
  return parseLaunchContent({
    clubs: clubsJson,
    onboarding: onboardingJson,
    powers: powersJson,
    training: trainingJson,
    events: eventsJson,
  });
}
