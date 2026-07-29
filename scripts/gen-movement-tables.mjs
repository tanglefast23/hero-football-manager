// Generates fixed-point PAC and STA tables. Runtime sim code uses no transcendentals.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const outputDirectory = process.argv[2] ?? 'src/sim';
const MAX_ATTRIBUTE = 999;
const PACE_SCALE = 128;
const STAMINA_SCALE = 1000;
const PACE_REFERENCE_RATING = 73;
const PACE_REFERENCE_SPEED = 113;
const PACE_ALPHA = Math.log(2) / Math.log(MAX_ATTRIBUTE);
const HOME_TIER_TRAINING_STEPS = [
  [94, 5],
  [180, 8],
  [268, 12],
  [356, 17],
  [442, 23],
];

function matchAttribute(rawAttribute) {
  if (rawAttribute <= 99) return rawAttribute;
  return 99 + Math.round(50 * (rawAttribute - 99) / (rawAttribute + 101));
}

function shippedEndurance(rawStamina) {
  const effectiveStamina = matchAttribute(rawStamina);
  if (effectiveStamina <= 99) return 1.6 - effectiveStamina * 0.006;
  return Math.max(0.65, 1.006 - (effectiveStamina - 99) * 0.008);
}

function shippedSlide(rawStamina) {
  const effectiveStamina = matchAttribute(rawStamina);
  if (effectiveStamina <= 99) return 1 + 0.6 * (100 - effectiveStamina) / 100;
  return Math.max(0.65, 1.006 - (effectiveStamina - 99) * 0.009);
}

const paceMultiplier = PACE_REFERENCE_SPEED / (PACE_REFERENCE_RATING ** PACE_ALPHA);
const paceValues = [];
for (let rating = 1; rating <= MAX_ATTRIBUTE; rating += 1) {
  const generated = Math.round(PACE_SCALE * paceMultiplier * (rating ** PACE_ALPHA));
  paceValues.push(rating === 1 ? generated : Math.max(generated, paceValues[rating - 2] + 1));
}
if (paceValues[MAX_ATTRIBUTE - 1] > paceValues[0] * 2) {
  paceValues[MAX_ATTRIBUTE - 1] = paceValues[0] * 2;
}

const enduranceValues = Array.from(
  { length: MAX_ATTRIBUTE },
  (_, index) => Math.round(STAMINA_SCALE * shippedEndurance(index + 1)),
);
const slideValues = Array.from(
  { length: MAX_ATTRIBUTE },
  (_, index) => Math.round(STAMINA_SCALE * shippedSlide(index + 1)),
);

// matchAttribute's integer plateaus must not make a whole home-tier drill inert.
// Preserve the shipped curve everywhere possible, applying the smallest 1/1000
// correction only when a tier's trained endpoint would otherwise tie its start.
for (const [rating, gain] of HOME_TIER_TRAINING_STEPS) {
  const trainedIndex = rating + gain - 1;
  if (enduranceValues[trainedIndex] >= enduranceValues[rating - 1]) {
    enduranceValues[trainedIndex] = enduranceValues[rating - 1] - 1;
  }
  if (slideValues[trainedIndex] >= slideValues[rating - 1]) {
    slideValues[trainedIndex] = slideValues[rating - 1] - 1;
  }
}
for (let index = 1; index < MAX_ATTRIBUTE; index += 1) {
  enduranceValues[index] = Math.min(enduranceValues[index], enduranceValues[index - 1]);
  slideValues[index] = Math.min(slideValues[index], slideValues[index - 1]);
}

mkdirSync(outputDirectory, { recursive: true });
writeFileSync(
  join(outputDirectory, 'pace-table.json'),
  JSON.stringify({
    scale: PACE_SCALE,
    referenceRating: PACE_REFERENCE_RATING,
    referenceSpeed: PACE_REFERENCE_SPEED,
    values: paceValues,
  }),
);
writeFileSync(
  join(outputDirectory, 'stamina-tables.json'),
  JSON.stringify({ scale: STAMINA_SCALE, endurance: enduranceValues, slide: slideValues }),
);
console.log(`wrote ${paceValues.length} pace and ${enduranceValues.length} stamina entries`);
