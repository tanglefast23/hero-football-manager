"""Build the playtest report from captured game evidence. No game files change."""
from pathlib import Path
from collections import Counter
import base64
import hashlib
import html
import json
import struct

ROOT = Path(__file__).resolve().parent
first = json.loads((ROOT / 'evidence.json').read_text())
second = json.loads((ROOT / 'evidence-segment-2.json').read_text())
career = second['crashCareer']
tactics = json.loads((ROOT / 'tactics-results.json').read_text())
seasons = first['seasons'] + second['seasons']
club = next(c for c in career['clubs'] if c['id'] == career['userClubId'])
buildings = career['facilities']['grid']['buildings']
capital = sum(b['capitalInvested'] for b in buildings)
assert capital == 221000
assert career['totalInstantDrills'] == 290
assert club['cash'] == 21799

sections = []
def section(title, paragraphs=(), bullets=(), table=None, code=None, figures=None, key=None):
    item = dict(title=title, paragraphs=list(paragraphs), bullets=list(bullets))
    if table: item['table'] = table
    if code: item['code'] = code
    if figures: item['figures'] = figures
    if key: item['key'] = key
    sections.append(item)

followup = json.loads((ROOT / 'follow-up.json').read_text())
section(followup['title'], followup['paragraphs'], table=followup['table'], figures=followup['figures'], key='follow-up')

section('Original run: blocked in Season 3, not beaten', [
    'I completed two seasons, 39 matches, and 290 instant drills. I earned promotion from D5, then finished third in D4.',
    'The run stopped at Season 3, Week 5. Selling Sol Reed caused an AI lineup error before the first league match.',
    'Back to Title and a full page reload both returned to the same error. I did not win D1 or the Hero Cup.',
    'The best next strategy is to build income early, buy strong starters, and train pace sooner. The later-game plan below remains unproved in this run.'
], key='result')

section('What was tested', [
    'Career seed: 3521330691. Difficulty: Chairman. Club: Bramble Rovers. Created player: Ace, a forward.',
    'Source baseline: 17577f73205890dd20fc1a935c75c036e8e0b1ed. Engine: m2.9. The run started on 18 October and ended on 19 October 2026, Vietnam time.',
    'I used the background Paseo browser at 900 × 600. The built-in IAB surface was unavailable. Game volume stayed at zero, with media guards installed.',
    'Career actions used rendered controls. Store access was read-only for inspection. No stats, cash, results, or saves were injected.',
    'Most matches used Quick Match. Two matches were watched at 3× speed. No match result was rerolled.',
    'Concurrent work changed the main checkout during Season 2. I moved the server to a detached baseline checkout with locked dependencies.',
    'The same browser origin retained the career. There is a UI-log gap around that reload. The saved match records and drill counter remained available.',
    'No game source changes were made during the original run. The dated follow-up records later local fixes. No commits, pushes, or releases were made.'
], key='scope')

season_rows = []
for item in seasons:
    r = item['recap']
    season_rows.append([r['season'], f"D{r['division']}", r['finalPosition'], f"{r['won']}–{r['drawn']}–{r['lost']}", f"{r['goalsFor']}–{r['goalsAgainst']}", r['cupResult'], f"${r['closingCash']:,}"])
season_rows.append([3, 'D4', 'Blocked before match 1', '0–0–0', '0–0', 'Not played', '$21,799 at W5'])
section('Career results', [
    'League results total 36 matches. The three Cup matches were a 0–3 loss, a 2–0 win, and a 0–8 loss.',
    'Season 1: second place earned promotion. Ace scored 12 league goals.',
    'Season 2: Ben Stone scored 25 league goals. The team improved its attack but missed promotion.',
    'The two clubs relegated from D3 took the promotion places. This run also contained training and recruitment mistakes.',
    'The clearest watched success was a 7–0 win over Zircon Casuals. I used 3-4-3, Attack, and Save Energy.'
], table=dict(headers=['Season', 'Division', 'Place', 'W–D–L', 'GF–GA', 'Cup exit', 'Cash'], rows=season_rows), key='results')

section('Money spent and decisions made', [
    'I invested $221,000 in facilities: $124,500 in new buildings and $96,500 in upgrades.',
    'I bought four Tier 2 drill paths for $20,000. Scouting cost $10,250 across four missions.',
    'Transfer fees totalled $43,769. Player sales returned $76,308, including the Sol Reed sale that later blocked the career.',
    'I kept two licensed heroes: Ace with Portal Pass and Ed Stone with Web Trap.',
    'I hired Mei Chen as head coach and Rafael Costa as assistant. Their actual wages were $900 and $300 weekly.',
    'The final training supply was 44 TP each week: 10 base, 24 from the Training Pitch, and 10 from coaches.'
], table=dict(headers=['Decision', 'Actual cost or result', 'Assessment'], rows=[
    ['Leo Knox, goalkeeper', '$23,703 fee; $300/week when signed', 'Major early upgrade; starting keeper through the run'],
    ['Wes Jett, forward', '$20,066 fee; $200/week when signed', 'Fast, skilled forward; PAC 116 when signed'],
    ['Kai Stone, academy keeper', '$500 signing; immediate $5,776 sale', '$5,276 same-week profit; balance review needed'],
    ['Sol Reed, unlicensed hero', 'Sold for $35,163; saved $652/week', 'Financially sensible; exposed the career blocker'],
    ['Week 19 team trips', '36 TP in S1; 48 TP in S2', 'Whole-squad gains; exercised through the browser'],
    ['Ed Stone renewal', '$925 asking wage; signed for $744/week', 'Three years and a Starter promise'],
]), key='spending')

facility_names = {
    'training-pitch': 'Training Pitch', 'coaching-office': 'Coaching Office',
    'stadium-stand': 'Stadium Stand', 'fan-shop': 'Fan Shop', 'tech-center': 'Tech Center',
    'scout-office': 'Scout Office', 'gym': 'Gym', 'dorm': 'Dorm', 'medical-bay': 'Medical Bay',
    'shooting-range': 'Shooting Range', 'keeper-court': 'Keeper Court', 'youth-field': 'Youth Field',
}
facility_rows = []
for kind, name in facility_names.items():
    owned = [b for b in buildings if b['type'] == kind]
    facility_rows.append([name, len(owned), ', '.join(f"L{b['level']}" for b in owned), f"${sum(b['capitalInvested'] for b in owned):,}"])
section('Facilities at the stopping point', [
    'All 12 facility types were built. The club owned 16 buildings, with all three adjacency combinations active.',
    'The combinations were Fan Shop + Stadium Stand, Gym + Dorm, and Medical Bay + Training Pitch.',
    'No construction was unfinished at the crash. Weekly upkeep was $1,435.'
], table=dict(headers=['Facility', 'Count', 'Levels', 'Capital paid'], rows=facility_rows), key='facilities')

section('The strategy I would use on the next attempt', bullets=[
    'Build the Training Pitch first. Then unlock the assistant through the Coaching Office. Their early TP keeps producing gains all season.',
    'Build extra Level 1 Fan Shops and Stadium Stands before expensive commercial upgrades. A new stand adds 100 percentage points for $10,000. Its first upgrade adds 50 for $25,000.',
    'Keep about four weeks of net non-match spending in cash. This squad needed roughly $14,000 after merchandise income. My earlier $1,577 low point was too risky.',
    'Buy a strong starting goalkeeper and a fast forward before buying every support facility. Keep a spare goalkeeper and usable outfield cover.',
    'Prioritize young starters, useful role stats, and pace. Do not keep raising DEF while the same defender cannot reach a runner.',
    'Goalkeeper REF includes an intentional display bonus. Compare match performance when judging keepers. Changing the display needs an owner decision.',
    'Train pace much earlier. The sampled Bramble XI had median PAC 62. Hollow Union and Ashford Olympic had 98 and 99.',
    'Use the best legal natural-role XI. Keep 4-4-2 while only two forwards are strong. Consider 4-3-3 or 3-4-3 after a strong third forward arrives.',
    'Use Quick Match against weaker teams for speed. Watch close promotion and Cup matches when changing energy or playstyle can matter.',
    'In watched matches, test Save Energy first. Avoid using All-out for the whole match. The measured policy advantage is limited to the sampled teams.',
    'Send scouts early enough to return during Weeks 1–4 or 17–18. A position-specific brief can take four weeks. Check its exact arrival week.',
    'Use three-year contracts for affordable core players. Use Starter promises only for players who should remain first choice.',
    'Keep hero capacity available for useful awakenings. In this source version, avoid selling heroes until the AI lineup bug is fixed.',
    'Answer player requests before their deadline. Squad requests can affect everyone, including the asker. The current refusal text understates that cost.'
], key='strategy')

section('What I would change in my own play', bullets=[
    'I spread TP into the backup goalkeeper and overdeveloped defensive stats. I should have fixed starting pace and stamina sooner.',
    'I built every support facility to exercise the system. A pure speed run should delay the less useful ones.',
    'I did not finish the D4 rebuild before the first transfer window closed. That helped cost a season.',
    'The Season 3 MID mission showed a four-week duration. I sent it in Week 1 anyway. Missing the opening window was my mistake.',
    'The 7–0 watched win does not prove that 3-4-3 always wins. Later Quick Match losses showed that it does not.',
    'This was one adaptive career, not an optimized run across many career seeds. I cannot claim a minimum season count.'
], key='lessons')

energy_rows = []
for mode, label in [('SAVE_ENERGY', 'Save Energy'), ('BALANCED', 'Balanced'), ('ALL_OUT', 'All-out')]:
    rows = [r for r in tactics['rows'] if r['energyUse'] == mode]
    n = sum(r['matches'] for r in rows)
    wins, draws, losses = (sum(r[k] for r in rows) for k in ('wins', 'draws', 'losses'))
    energy_rows.append([label, n, f'{wins}–{draws}–{losses}', f'{(3*wins+draws)/n:.2f}', f"{sum(r['meanFinalCondition']*r['matches'] for r in rows)/n:.1f}"])
section('Tactics check: 648 separate headless matches', [
    'I tested three formations, two playstyles, and three energy settings against three captured opponents. Each combination used 12 seeds.',
    'These are production-engine simulations, separate from the browser career. They did not change the saved game.',
    'The fixed Season 2 squad played at home against Hollow Union, Ashford Olympic, and Zircon Casuals.',
    'Across this sample, Save Energy kept more condition and earned more points. All-out performed worst.',
    'The best single formation/playstyle/energy group was 4-4-2, Attack, Balanced: 24 wins, four draws, and eight losses across 36 games.',
    'That group averaged 2.11 points. Different opponents favored different settings. This is not proof of a universal best tactic.',
    'Quick Match only receives the formation preference from the UI. It uses automatic powers and substitutions. Watched energy changes do not carry into Quick Match.'
], table=dict(headers=['Energy setting', 'Matches', 'W–D–L', 'Points/game', 'Mean final condition'], rows=energy_rows), key='tactics')

findings = [
 dict(id='F01', priority='P1', kind='bug', title='Selling a hero can block the whole career',
      observed='I sold unlicensed Sol Reed to Dunwich Panthers for $35,163 in S3 W1. At S3 W5, the screen failed with: Hero bramble-rovers-p15 must be licensed or benched.',
      impact='No match controls or title screen remained usable. The buyer was in a different fixture. Back to Title and a full reload repeated the error.',
      cause='Sales set licensed to false. The AI freshness picker admits unlicensed heroes. It chose Sol despite his absence from the saved starting XI. Rival preload then built an invalid team.',
      fix='Exclude unlicensed heroes from AI selection. Cover hero sales with a regression check. Also prevent rival preload from trapping the title and crash recovery screens.',
      evidence='Browser screenshot 04; captured crashCareer; blocker-check.txt. The same check also failed against the main checkout. Excluding Sol through an existing availability rule on a copy removed the error.',
      sources=['src/game/market-career.ts:1590', 'src/game/squad.ts:431', 'src/game/lineup.ts:160', 'App.tsx:2662']),
 dict(id='F02', priority='P2', kind='design', title='Displayed REF can reverse the apparent ranking of two goalkeepers',
      observed='At S2 W21, Jae Gray showed REF 210 but stored 102. Leo Knox showed 201 but stored 145.',
      impact='The weaker keeper appears stronger on the card. Training decisions can follow a value that the match engine never uses.',
      cause='refDisplayBonus intentionally banks a visual-only training bonus. Match selection, transfer valuation, and the engine use attrs.ref.',
      fix='Show the actual match stat and actual drill gain. If a separate development score is wanted, name and explain it separately. Treat any migration as a distinct design task.',
      evidence='evidence.json finding reflexes-display. This is deliberate code behavior, reported as a design problem rather than an accidental sim defect.',
      sources=['src/application/displayed-attributes.ts:7', 'src/game/training.ts:223', 'src/game/training.ts:318', 'src/game/squad.ts:174']),
 dict(id='F03', priority='P2', kind='bug', title='Coach hire confirmation understates the actual wage',
      observed='With Coaching Office L2, Mei Chen was quoted at $600/week and Level 2. Hiring produced Level 3 at $900/week. The same office-bonus code can raise an assistant wage from $150 to $300/week. A separate captured assistant quote was not found.',
      impact='The player approves one recurring cost and receives another. The hire celebration also uses the old level and effects.',
      cause='The transaction applies the office level bonus and recomputes wages. The quote and celebration use the candidate before that adjustment.',
      fix='Calculate one effective hire quote. Use its level, effects, and wage in affordability checks, confirmation, and the hire result.',
      evidence='evidence.json finding coach-hire-quote captures the $600 confirmation and the actual $900 coach.',
      sources=['src/game/market-career.ts:1685', 'src/application/market-view-model.ts:677', 'App.tsx:1337', 'App.tsx:4123']),
 dict(id='F04', priority='P2', kind='bug', title='Squad request refusal hides the real penalties',
      observed='Ken Ash asked for One big night out in S2 W28. Refuse advertised −5 loyalty and −8 morale. Ken actually lost 7 and 11. Every other player lost 2 and 3.',
      impact='The choice hides a whole-squad cost and understates the asking player’s loss.',
      cause='resolutionDeltas adds asker and squad deltas. The view model prints only asker deltas.',
      fix='Show the asking player’s total change and the other players’ change. Use the same calculation for refusal and lapse warnings.',
      evidence='evidence-segment-2.json finding request-refusal-omits-squad-cost contains every before/after delta.',
      sources=['src/game/player-requests.ts:459', 'src/application/player-request-view-model.ts:108', 'src/application/player-request-view-model.ts:146']),
 dict(id='F05', priority='P2', kind='balance', title='An academy signing produced immediate cash profit',
      observed='I signed Kai Stone for $500 in S2 W1, then immediately sold him for $5,776. Profit was $5,276 before any training, match, or week advance.',
      impact='A cheap intake can become a cash conversion rather than a player development choice.',
      cause='The low signing fee and ordinary transfer valuation allow an immediate profitable sale when squad cover permits it.',
      fix='Decide whether this is intended. Options include an initial resale discount or a short registration period. Do not remove normal academy development profits.',
      evidence='Cash transactions 17 and 18, and evidence.json finding academy-resale-confirmed. Verified once; not an unlimited-money claim.',
      sources=['src/game/market-career.ts:1532', 'src/game/market.ts:604']),
 dict(id='F06', priority='P3', kind='copy', title='Created-player wage copy still says $180',
      observed='The creation card showed $180/week. Ace entered the career on $153/week.',
      impact='The first contract does not match the terms shown during creation.',
      cause='Creation uses reducedPlayerWeeklyWage(180), while the English text still hardcodes 180.',
      fix='Format the terms from the actual creation wage. Check all language catalogs.',
      evidence='Ace’s first captured roster and the creation text. The actual wage is lower, so this does not overcharge the player.',
      sources=['src/game/onboarding/player-creation.ts:29', 'content/i18n/en.json:814']),
 dict(id='F07', priority='P3', kind='docs', title='The drill guide disagrees with the shipped Tier 5 ladder',
      observed='The guide says +20 outfield and +11 keeper at Tier 5. The captured rules ship +18 and +10.',
      impact='The guide also promises rising efficiency. Raw outfield gain falls from 13/26 = 0.500 per TP to 18/39 = 0.462.',
      cause='The canonical guide did not follow the current content values.',
      fix='Reconcile the guide and content after deciding the intended ladder. Show the real tradeoff before the $60,000 upgrade.',
      evidence='crashCareer.trainingRules and docs/05. This was checked in code, not purchased in this career. Modifiers and SUPER can affect realized value.',
      sources=['docs/05-players-training-coaches.md:62', 'content/training.json']),
 dict(id='F08', priority='P3', kind='copy', title='Generic scouting copy omits four-week missions',
      observed='The board says reports take two or three weeks. A position-specific mission can take four. My S3 W1 MID mission was due in Week 5.',
      impact='Generic advice can lead to a missed transfer window. The exact mission slip does show its duration.',
      cause='Duration is two or three weeks plus one for a role-specific profile. The generic text omits that extra week.',
      fix='Say two to four weeks. Showing the arrival week beside the registration deadline would also help.',
      evidence='The captured active mission ran from absolute week 61 to 65. Sending it too late was my mistake, not a hidden duration change.',
      sources=['src/game/market.ts:234', 'content/i18n/en.json:1599']),
]

current_findings = {row[0]: row[1:] for row in followup['table']['rows']}
for finding in findings:
    finding['status'], finding['currentVerification'] = current_findings[finding['id']]

finding_fields = [
    ('observed', 'Original observation'),
    ('impact', 'Original impact'),
    ('cause', 'Original cause'),
    ('fix', 'Original recommendation'),
    ('evidence', 'Original evidence'),
]

section('Balance observations that need more evidence', bullets=[
    'Commercial buildings were strong investments. Season 2 produced $176,491 in tickets and $71,645 in merchandise. Wages plus upkeep cost $138,285.',
    'This does not prove that money is too easy. I repeatedly ran low on cash, and D3–D1 has additional costs.',
    'Relegated stronger clubs can make the next division feel uneven. Recheck this across career seeds with a better recruitment policy.',
    'Save Energy beat All-out in the fixed tactics sample. Test away matches, late substitutions, and other squad strengths before changing balance.',
    'The browser logged repeated WebGL context-limit warnings during the long session. I did not prove a leak or connect them to a match failure.',
    'The earlier reload happened during concurrent source and dependency changes. It is separate from the reproducible sold-hero failure.'
], key='balance')

section('D3–D1 plan: code-backed, not reached in this run', bullets=[
    'D3 grants the third hero slot and unlocks Tier 3 drills. Rebuild weak positions before committing to a costly marquee hero.',
    'Check Green Bull before individual drills. It starts at $50,000, consumes the whole TP bank, and gives the squad +2 to stored attributes.',
    'Green Bull adds $25,000 per prior visit for the first ten increases, then $50,000. Its value depends on the roster and cash reserve.',
    'D3 also unlocks banked coach speeches for watched matches. A speech consumes the TP bank and gives +6 second-half attributes; D2 gives +8 and D1 +10.',
    'D2 unlocks Level 3 facilities. Upgrade the TP engine and commercial output before lower-priority facilities.',
    'D1 grants the fourth hero slot. The main journey requires both the D1 title and the Hero Cup.',
    'Watch decisive matches when tactical controls can change the result. Preserve healthy cover for shared league and Cup weeks.',
    'This run did not exercise D3–D1 management, Green Bull bookings, the D1 title, or the Cup ending. No endgame win is claimed.'
], key='endgame')

section('Behaviors I did not count as bugs', bullets=[
    'Quick Match uses automatic powers and substitutions. That is intentional.',
    'The first-match tutorial delays automatic substitutions until the lesson is introduced.',
    'The short confirmation guard can ignore a very fast second press. Automation must wait for the guard.',
    'Drill presentations are skippable, and consecutive drills already exist. Repeated manual viewing is not required.',
    'Wins in recent form use trophy art. Missing letter W text alone is not missing match history.',
    'Starter promises constrain lineup changes. Those constraints were disclosed when signing.'
], key='rejected')

section('Original-run verification and limits', [
    'Passed: four focused Jest suites, 106 tests. The tests cover instant training, midseason training, market careers, and career persistence.',
    'Passed: npx tsc --noEmit on the pinned baseline. The command returned exit code 0 with no diagnostic output.',
    'Passed: the 648-match tactics probe, including deterministic repeat and unchanged input checks.',
    'Failed as expected: reproduce-career-blocker.cjs returned exit code 1 on the baseline and main checkout. Both printed the exact sold-hero error.',
    'The existing passing tests do not cover this AI selection failure. The reproduction script preserves a small regression check for it.',
    'Browser coverage was desktop web, with silent audio. No physical iPhone, PWA, native, audible audio, or Steam performance claim is made.',
    'The QA page was destroyed and closed. The QA server was stopped. The listener audit found no remaining Hero Football Manager listener.',
    'No game fixes occurred during the original run. Later fixes are in the dated follow-up. Unrelated dirty files were preserved, and nothing was published.'
], code='node artifacts/playtest-2026-10-18/reproduce-career-blocker.cjs\n# Exit 1 currently reproduces the bug. Exit 0 means the rival teams now build.', key='verification')

section('Screenshots', figures=[
    ['01-opening-match.png', 'Opening watched match. This is playthrough evidence, not a claim that the match was won.'],
    ['02-season-1-promotion.png', 'Season 1 awards screen: Ken Ash, second in completed passes. The filename is historical; this image is not promotion proof.'],
    ['03-three-forwards-7-0.png', 'Watched 7–0 win over Zircon Casuals with 3-4-3, Attack, Save Energy.'],
    ['04-unlicensed-hero-crash.png', 'Career blocker after Sol Reed’s sale. Back to Title and reload repeated this screen.'],
], key='screenshots')

section('Evidence files', bullets=[
    'evidence.json: first segment, including Season 1, transactions, coach quote, and REF comparison.',
    'evidence-segment-2.json: second segment, Season 2 result, request penalties, and the full blocked career snapshot.',
    'tactics-teams.json and tactics-results.json: captured teams and all 54 policy/opponent result rows.',
    'tactics-probe.cjs: runnable supplemental production-engine probe. It uses fresh seeds, not career fixtures.',
    'reproduce-career-blocker.cjs: read-only regression check using the captured career.',
    'focused-tests.txt, blocker-check.txt, and current-source-blocker-check.txt: actual check output.',
    'browser-reload-log.json and crash-browser-log.json: separate logs for environment reload and the career blocker.',
    'browser-driver.js: historical temporary helper, adapted during play. Use scripts/qa/playtest-browser.js for future runs. The JSON action logs are the run evidence, not an exact replay script.'
], key='evidence')

metadata = dict(
    baseline='17577f73205890dd20fc1a935c75c036e8e0b1ed', engine='m2.9', seed=3521330691,
    status='blocked', completedSeasons=2, leagueMatches=36, cupMatches=3, instantDrills=290,
    facilityCapital=capital, buildings=len(buildings), cash=club['cash'],
    recordedActions=len(first['actions']) + len(second['actions']),
    note='UI logs have a reload gap; match totals come from persisted fixtures.',
    sha256={name: hashlib.sha256((ROOT/name).read_bytes()).hexdigest() for name in ['evidence.json', 'evidence-segment-2.json', 'tactics-results.json']},
)
(ROOT / 'report-data.json').write_text(json.dumps(dict(metadata=metadata, sections=sections, findings=findings), indent=2, ensure_ascii=False) + '\n')

def md_table(t):
    esc = lambda x: str(x).replace('|', '\\|').replace('\n', ' ')
    rows = ['| ' + ' | '.join(map(esc, t['headers'])) + ' |', '| ' + ' | '.join('---' for _ in t['headers']) + ' |']
    rows += ['| ' + ' | '.join(map(esc, row)) + ' |' for row in t['rows']]
    return '\n'.join(rows)

def md_section(s):
    out = ['## ' + s['title'], '']
    for p in s['paragraphs']: out += [p, '']
    if s['bullets']: out += ['- ' + x for x in s['bullets']] + ['']
    if 'table' in s: out += [md_table(s['table']), '']
    if 'code' in s: out += ['```sh', s['code'], '```', '']
    for file, caption in s.get('figures', []): out += [f'![{caption}]({file})', '', caption, '']
    return '\n'.join(out)

md = ['# Hero Football Manager — browser playtest report', '', '19 October 2026 · Chairman · Seed 3521330691', '']
for s in sections:
    if s['key'] == 'balance':
        md += ['## Original findings and current status', '', 'Grok’s confirmed fixes are applied locally. Six findings are corrected. Two remain design or balance decisions. The observations below describe the original source.', '']
        for f in findings:
            md += [f"### {f['id']} · {f['priority']} · {f['title']}", '', f"Type: {f['kind']}.", '']
            md += [f"**Current status: {f['status']}.** {f['currentVerification']}", '']
            for key, label in finding_fields:
                md += [f"**{label}:** {f[key]}", '']
            md += ['Source: ' + ', '.join('`' + x + '`' for x in f['sources']) + '.', '']
    md.append(md_section(s))
(ROOT / 'report.md').write_text('\n'.join(md))

E = html.escape
def html_table(t):
    return '<div class="table-scroll"><table><thead><tr>' + ''.join('<th scope="col">'+E(str(x))+'</th>' for x in t['headers']) + '</tr></thead><tbody>' + ''.join('<tr>'+''.join('<td>'+E(str(x))+'</td>' for x in row)+'</tr>' for row in t['rows']) + '</tbody></table></div>'

def html_section(s):
    out = [f'<section id="{s["key"]}"><h2>{E(s["title"])}</h2>']
    out += ['<p>'+E(p)+'</p>' for p in s['paragraphs']]
    if s['bullets']: out += ['<ul>'+''.join('<li>'+E(b)+'</li>' for b in s['bullets'])+'</ul>']
    if 'table' in s: out += [html_table(s['table'])]
    if 'code' in s: out += ['<pre><code>'+E(s['code'])+'</code></pre>']
    if 'figures' in s:
        out += ['<div class="figures">']
        for file, caption in s['figures']:
            png = (ROOT/file).read_bytes()
            width, height = struct.unpack('>II', png[16:24])
            data = base64.b64encode(png).decode()
            out += [f'<figure><img src="data:image/png;base64,{data}" alt="{E(caption)}" width="{width}" height="{height}"><figcaption>{E(caption)}</figcaption></figure>']
        out += ['</div>']
    out += ['</section>']
    return ''.join(out)

parts = []
for s in sections:
    if s['key'] == 'balance':
        parts += ['<section id="findings"><h2>Original findings and current status</h2><p>Grok’s confirmed fixes are applied locally. Six findings are corrected. Two remain design or balance decisions. The observations below describe the original source.</p><label class="filter">Show <select id="filter"><option value="all">All findings</option><option value="bug">Functional bugs</option><option value="balance">Balance observation</option><option value="design">Design decision</option><option value="copy">Copy defects</option><option value="docs">Documentation</option></select></label><p id="filter-count" aria-live="polite">8 findings</p>']
        for f in findings:
            parts += [f'<article class="finding" data-kind="{f["kind"]}" data-status="{E(f["status"])}" id="{f["id"]}"><h3><span class="priority {f["priority"]}">{f["id"]} · {f["priority"]}</span> {E(f["title"])}</h3>']
            parts += [f'<p><strong>Current status: {E(f["status"])}.</strong> {E(f["currentVerification"])}</p>']
            for key, label in finding_fields:
                parts += [f'<p><strong>{label}:</strong> {E(f[key])}</p>']
            parts += ['<p class="sources">Source: '+', '.join('<code>'+E(x)+'</code>' for x in f['sources'])+'</p></article>']
        parts += ['</section>']
    parts += [html_section(s)]

template = '''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hero Football Manager — browser playtest</title><style>
:root{color-scheme:light;--ink:#24282b;--paper:#faf9f6;--line:#d9dcd8;--accent:#235a46;--bad:#95392f}*{box-sizing:border-box}body{margin:0;overflow-wrap:anywhere;background:var(--paper);color:var(--ink);font:17px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}header,main,footer{max-width:1120px;margin:auto;padding:34px 28px}header{padding-bottom:12px}h1{font-size:clamp(30px,5vw,50px);line-height:1.12;letter-spacing:-.035em;margin:16px 0}h2{font-size:27px;line-height:1.25;margin:0 0 22px}h3{font-size:21px;line-height:1.4}p{max-width:85ch;margin:14px 0}a{color:var(--accent)}.eyebrow{font-size:14px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#57615a}.status{display:inline-block;color:var(--bad);background:#f4e6e2;border:1px solid #d7b2a9;padding:5px 12px;font-weight:700}.metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--line);border:1px solid var(--line);margin:25px 0}.metric{padding:18px;background:var(--paper)}.metric strong{font-size:31px;display:block;line-height:1.2}.metric span{font-size:14px}nav{display:flex;flex-wrap:wrap;gap:7px 20px;padding:12px 0}section{padding:34px 0;border-top:1px solid var(--line);scroll-margin-top:20px}section:first-child h2{color:var(--bad)}li{margin:11px 0;max-width:88ch}ul{padding-left:24px}.table-scroll{overflow:auto;margin:25px 0}table{width:100%;border-collapse:collapse;font-size:15px;white-space:normal}th,td{text-align:left;padding:12px 14px;border-bottom:1px solid var(--line);vertical-align:top}th{background:#eeefea;font-size:13px;text-transform:uppercase;letter-spacing:.035em}.finding{padding:12px 0 25px;border-bottom:1px solid var(--line)}.finding:last-child{border-bottom:0}.priority{font-size:13px;padding:4px 8px;background:#e6ebe5;white-space:nowrap;vertical-align:middle}.P1{background:#f4dfd9;color:var(--bad)}.sources{font-size:13px;overflow-wrap:anywhere;color:#56605c}code{font-family:ui-monospace,SFMono-Regular,monospace;font-size:.88em}pre{white-space:pre-wrap;background:#edf0ea;padding:20px;overflow-wrap:anywhere}.filter{display:inline-flex;align-items:center;gap:12px}select{font:inherit;padding:8px 12px;background:white;border:1px solid #8c9790;border-radius:3px;min-height:44px}.figures{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:24px}figure{margin:0;min-width:0}img{width:100%;max-width:100%;height:auto;border:1px solid var(--line)}figcaption{font-size:14px;line-height:1.45;margin:10px 0}footer{font-size:14px;border-top:1px solid var(--line);color:#5b625e}[hidden]{display:none!important}@media(max-width:650px){header,main,footer{padding-left:18px;padding-right:18px}.metrics{grid-template-columns:1fr}.metric{display:flex;align-items:baseline;gap:15px}.metric strong{font-size:27px}.figures{grid-template-columns:minmax(0,1fr)}th,td{padding:10px 8px}}@media print{body{font-size:11pt}header,main,footer{padding:14px 0}nav,.filter,#filter-count{display:none}.finding{break-inside:avoid}.figures{grid-template-columns:minmax(0,1fr)}img{max-width:650px}section{padding:20px 0}a{color:inherit}}
</style></head><body><header><div class="eyebrow">19 October 2026 · Chairman · Seed 3521330691</div><h1>Hero Football Manager<br>Browser playtest</h1><div class="status">Blocker fixed locally · Game not beaten</div><div class="metrics"><div class="metric"><strong>39</strong><span>original matches · 1 more after fix</span></div><div class="metric"><strong>290</strong><span>instant drills completed</span></div><div class="metric"><strong>$221,000</strong><span>invested in facilities</span></div></div><nav aria-label="Report sections"><a href="#follow-up">Fix follow-up</a><a href="#results">Results</a><a href="#spending">Spending</a><a href="#strategy">Strategy</a><a href="#tactics">Tactics</a><a href="#findings">Findings</a><a href="#verification">Checks</a><a href="#screenshots">Screenshots</a></nav></header><main>CONTENT</main><footer>Local fixes only. No commits or releases. Original run: baseline 17577f73 · engine m2.9. See the dated follow-up for current checks.</footer><script>
const filter=document.getElementById('filter');filter.addEventListener('change',()=>{let count=0;document.querySelectorAll('.finding').forEach(card=>{card.hidden=filter.value!=='all'&&card.dataset.kind!==filter.value;if(!card.hidden)count++});document.getElementById('filter-count').textContent=count+' findings';});
</script></body></html>'''
(ROOT / 'report.html').write_text(template.replace('CONTENT', ''.join(parts)))
print(f'REPORT_BUILT: {len(findings)} findings; {len(sections)} sections; 39 career matches; 648 supplemental matches')
