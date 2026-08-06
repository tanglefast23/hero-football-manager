/**
 * Static web exports are an intentional review surface, while an App Store
 * archive must always enter the real game even if a QA environment variable is
 * accidentally present when Metro bundles it.
 */
export function qaRootRoutesEnabled(isDev: boolean, platform: string): boolean {
  return isDev || platform === 'web';
}
