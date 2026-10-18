"""Check report numbers, source paths, anchors, and embedded screenshot files."""
from pathlib import Path
from html.parser import HTMLParser
import base64
import hashlib
import json
import struct

root = Path(__file__).resolve().parent
repo = root.parent.parent
data = json.loads((root / 'report-data.json').read_text())
first = json.loads((root / 'evidence.json').read_text())
second = json.loads((root / 'evidence-segment-2.json').read_text())
career = second['crashCareer']
meta = data['metadata']
assert meta['status'] == 'blocked'
assert meta['seed'] == career['careerSeed']
assert meta['completedSeasons'] == len(first['seasons']) + len(second['seasons']) == 2
league = sum(x['recap']['played'] for x in first['seasons'] + second['seasons'])
cup = [f for c in career['m2']['nationalCups'] for r in c['rounds'] for f in r['fixtures']
       if f['status'] == 'played' and career['userClubId'] in (f['homeClubId'], f['awayClubId'])]
assert league == meta['leagueMatches'] == 36
assert len(cup) == meta['cupMatches'] == 3
assert meta['instantDrills'] == career['totalInstantDrills'] == 290
assert meta['facilityCapital'] == sum(b['capitalInvested'] for b in career['facilities']['grid']['buildings']) == 221000
assert meta['buildings'] == len(career['facilities']['grid']['buildings']) == 16
assert meta['cash'] == next(c['cash'] for c in career['clubs'] if c['id'] == career['userClubId']) == 21799
for name, digest in meta['sha256'].items():
    assert hashlib.sha256((root/name).read_bytes()).hexdigest() == digest, name
for item in first['seasons'] + second['seasons']:
    r = item['recap']
    assert r['played'] == r['won'] + r['drawn'] + r['lost']
    assert len(item['fixtures']) == r['played']
findings = data['findings']
assert len({f['id'] for f in findings}) == len(findings) == 8
current_findings = {row[0]: row[1:] for row in json.loads((root/'follow-up.json').read_text())['table']['rows']}
for finding in findings:
    assert [finding['status'], finding['currentVerification']] == current_findings[finding['id']]
    for source in finding['sources']:
        file, separator, line = source.rpartition(':')
        if not separator or not line.isdigit(): file = source
        assert (repo/file).is_file(), source

class Document(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids, self.links, self.images = [], [], []
        self.finding_statuses = {}
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if 'id' in attrs: self.ids.append(attrs['id'])
        if tag == 'article' and attrs.get('class') == 'finding':
            self.finding_statuses[attrs['id']] = attrs['data-status']
        if tag == 'a': self.links.append(attrs['href'])
        if tag == 'img':
            assert attrs.get('alt')
            self.images.append(attrs['src'])

doc = Document()
page = (root/'report.html').read_text()
doc.feed(page)
assert len(doc.ids) == len(set(doc.ids))
assert doc.finding_statuses == {finding['id']: finding['status'] for finding in findings}
assert sum(status in ('Fixed locally', 'Guide corrected', 'Copy corrected') for status in doc.finding_statuses.values()) == 6
assert 'Original recommendation:' in page
for link in doc.links:
    assert link.startswith('#') and link[1:] in doc.ids, link
assert len(doc.images) == 6
for uri in doc.images:
    prefix, encoded = uri.split(',', 1)
    assert prefix == 'data:image/png;base64'
    png = base64.b64decode(encoded, validate=True)
    assert png[:8] == b'\x89PNG\r\n\x1a\n'
    assert struct.unpack('>II', png[16:24]) in ((900, 600), (1280, 800))
assert 'Game not beaten' in page
assert 'Career seed: 3521330691' in page
assert 'D3–D1 plan: code-backed, not reached in this run' in page
assert 'UI-log gap' in page
recovered = json.loads((root/'recovered-checkpoint.json').read_text())['career']
assert recovered['careerSeed'] == career['careerSeed']
assert (recovered['season'], recovered['week']) == (3, 6)
played = [f for f in recovered['fixtures'] if f['season'] == 3 and f['status'] == 'played' and recovered['userClubId'] in (f['homeClubId'], f['awayClubId'])]
assert len(played) == 1 and played[0]['id'] == 's3-r1-m1'
assert played[0]['score'] == {'homeGoals': 4, 'awayGoals': 2}
assert next(c['cash'] for c in recovered['clubs'] if c['id'] == recovered['userClubId']) == 40312
assert 'Blocker fixed locally' in page
assert '206 focused Jest tests' in page
print('REPORT_CHECK_PASSED: 8 findings; 39 original matches plus 1 after the fix; 290 drills; 6 embedded screenshots; all anchors and source paths valid.')
