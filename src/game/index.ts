export * from './assistant-guide';
export * from './archetype-caps';
export * from './board-ultimatum';
export * from './contract-promises';
export * from './contract-wages';
export * from './cup-giant-killing';
export * from './cup-mismatch-warning';
export * from './career';
export * from './career-events';
export * from './desk-tips';
export * from './difficulty';
export * from './cash-transactions';
export * from './coach-weekly';
export * from './club-business';
export * from './club-business-types';
export * from './event-clock';
export * from './facilities';
export * from './fan-growth';
// `headless.ts` is deliberately NOT re-exported, for the same reason
// `glyph-coverage.ts` is left out of the i18n barrel: it is a CI/test tool, not
// game code. It runs a whole career in a loop, no app screen calls it, and
// every test that wants it already imports `./headless` directly. Re-exported,
// it rode this barrel into the shipped web first-load bundle — confirmed by
// grepping the built `index-*.js` for its own error string, "headless full
// career exceeded".
export * from './lineup';
export * from './loyalty';
export * from './player-requests';
export * from './player-gifts';
export * from './pending-match-impact';
export * from './retirement';
export * from './rival-hero-intro';
export * from './matchday';
export * from './management';
export * from './market-career';
export * from './story-callbacks';
export * from './coach-speech';
export * from './midseason-training';
export * from './m2-career';
export * from './full-career';
export * from './legacy-career';
export * from './onboarding/player-creation';
export * from './ordering';
export * from './onboarding/story-onboarding';
export * from './post-match-awakening';
export * from './player-wellbeing';
export * from './player-appearance';
export * from './power-catalog';
export * from './progression';
export * from './promotion-progression';
export * from './pyramid';
export * from './schedule';
export * from './season-recap';
export * from './squad';
export * from './sponsors';
export * from './story-progression';
export * from './training';
export * from './training-paths';
export * from './training-point-income';
export * from './types';
export * from './youth-intake';
