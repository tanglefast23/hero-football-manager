import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

const club = read('src/ui/screens/ClubFinancesScreen.tsx');
const market = read('src/ui/screens/MarketScreen.tsx');
const league = read('src/ui/screens/M2LeagueScreen.tsx');
const tabs = read('src/ui/components/ScreenTabs.tsx');
const app = read('App.tsx');

/**
 * The Club office used to be one page five sections long: the balance, the
 * ledger, the staff and the grounds, in that order, on every viewport. The desk
 * sends the manager here for one of those four things at a time.
 */
describe('club office boards', () => {
  it('offers exactly Facility, Staff and Finances, in that order', () => {
    const strip = /CLUB_OFFICE_TABS[^[]*\[([\s\S]*?)\n\];/.exec(club);
    expect(strip).not.toBeNull();
    expect([...strip![1].matchAll(/id: '([a-z]+)'/g)].map(match => match[1]))
      .toEqual(['facility', 'staff', 'finances']);
  });

  it('files each section under one board', () => {
    // Facility carries the grid and the legacy pitch; Staff the coaches; the
    // rest is the accounts.
    expect(club).toContain("key: 'grounds',");
    expect(club).toMatch(/facilitySections[\s\S]{0,200}key: 'grounds',/);
    expect(club).toMatch(/staffSections[\s\S]{0,200}key: 'coaching-staff',/);
    expect(club).toMatch(/financeSections[\s\S]{0,200}key: 'cash-position',/);
    expect(club).toContain("activeTab === 'facility'");
    expect(club).toContain("? facilitySections");
  });

  it('lets the screen above choose the board', () => {
    // Owned in App because the inbox, the guide destinations and Bert's fans
    // lesson all open a specific one, and the lesson has to read it back.
    expect(club).toContain('activeTab: ClubOfficeTab;');
    expect(club).toContain('onSelectTab: (tab: ClubOfficeTab) => void;');
    expect(app).toContain('const [clubOfficeTab, setClubOfficeTab] = useState<ClubOfficeTab>');
    expect(app).toContain('activeTab={clubOfficeTab}');
    expect(app).toContain('onSelectTab={setClubOfficeTab}');
  });

  it('opens the board the desk is sending the manager to', () => {
    // The build job and the ledger warnings land on different boards.
    expect(app).toMatch(
      /alertId === 'training-ground' \|\| alertId === 'build-reminder'\)? \{\s*\n\s*setClubOfficeTab\('facility'\)/,
    );
    expect(app).toMatch(
      /alertId === 'financial-warning' \|\| alertId === 'emergency-loan'\) \{\s*\n\s*setClubOfficeTab\('finances'\)/,
    );
    expect(app).toContain("if (destination === 'club-facilities') setClubOfficeTab('facility');");
    expect(app).toContain("else if (destination === 'club-finances') setClubOfficeTab('finances');");
  });

  it('sends the Staff board straight to the coach desk of the market', () => {
    expect(app).toMatch(/onOpenCoachMarket=\{\(\) => \{[\s\S]{0,400}section: 'COACHES',/);
  });
});

/**
 * Three screens, one strip. League had it at the top; Market had a glyph docket
 * buried under the registration panel and none at all on a wide window.
 */
describe('the shared screen tab strip', () => {
  it('is the only place the strip is drawn', () => {
    for (const source of [club, market, league]) {
      expect(source).toContain('<ScreenTabs');
      expect(source).not.toContain('accessibilityRole="tab"');
    }
    expect(tabs).toContain('accessibilityRole="tab"');
  });

  it('rides in the header, above the desk it switches', () => {
    // Market's header is a const it hands to SectionFlow; the other two build
    // theirs inline. Either way the strip sits inside it, under the office name.
    expect(market).toMatch(/const header = \([\s\S]*?<ScreenTabs/);
    expect(market).toContain('header={header}');
    expect(club).toMatch(/header=\{[\s\S]{0,900}<ScreenTabs/);
    expect(league).toMatch(/header=\{[\s\S]{0,900}<ScreenTabs/);
  });

  it('keeps the pressed-state height guard the iOS layout depends on', () => {
    expect(tabs).toContain('min-h-14');
    expect(tabs).toContain('style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}');
  });

  it('draws nothing when there is only one board to choose', () => {
    // The Market in week 1: Coaches is the only desk unlocked, and a lone
    // full-width tab reads as a title wearing a button.
    expect(tabs).toContain('if (tabs.length < 2 && !showSingleTab) return null;');
  });
});
