import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('startup recovery', () => {
  it('keeps the screen error boundary inside a root safe-area provider', () => {
    const app = readFileSync(join(process.cwd(), 'App.tsx'), 'utf8');
    const appRootStart = app.indexOf('export default function App()');
    const appRootEnd = app.indexOf('\n}\n\nconst POWER_CUT_IN_QA_ENTRIES', appRootStart);
    const appRoot = app.slice(appRootStart, appRootEnd);

    expect(appRoot).toMatch(
      /<SafeAreaProvider>\s*<ScreenErrorBoundary[\s\S]*?<GameApp \/>[\s\S]*?<\/ScreenErrorBoundary>\s*<\/SafeAreaProvider>/,
    );
  });

  it('does not reconcile the assistant inbox again for its own career update', () => {
    const app = readFileSync(join(process.cwd(), 'App.tsx'), 'utf8');

    expect(app).toMatch(
      /reconciledAssistantInboxCareerRef\.current === career[\s\S]*?store\.reconcileAssistantInbox\(\);[\s\S]*?reconciledAssistantInboxCareerRef\.current = useM1Store\.getState\(\)\.career/,
    );
  });
});
