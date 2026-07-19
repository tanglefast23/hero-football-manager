export interface CareerProgress {
  season: number;
  week: number;
}

export function shouldShowOpeningBrief(progress: CareerProgress | null): boolean {
  return progress === null || (progress.season === 1 && progress.week === 1);
}
