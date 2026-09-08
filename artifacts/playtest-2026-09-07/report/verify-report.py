"""Run with python3 verify-report.py. Uses only the Python standard library."""
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
import json
import re


class ReportParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids, self.links, self.remote = [], [], []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if "id" in attrs:
            self.ids.append(attrs["id"])
        for key in ("href", "src"):
            value = attrs.get(key, "")
            if value.startswith("#"):
                self.links.append(value[1:])
            if value.startswith(("http:", "https:", "//")):
                self.remote.append(value)


page = Path(__file__).with_name("hero-football-manager-playtest-report.html").read_text()
parser = ReportParser()
parser.feed(page)
assert len(parser.ids) == len(set(parser.ids)), "Duplicate IDs"
assert set(parser.links) <= set(parser.ids), "Broken jump link"
assert not parser.remote, "Report must be standalone"
assert page.index('id="issue-01"') < page.index('id="verdict"') < page.index('id="season-1"')
data = json.loads(re.search(r'<script id="report-data" type="application/json">(.*?)</script>', page, re.S)[1])
assert [x["id"] for x in data["issues"]] == [f"{i:02}" for i in range(1, 31)]
assert Counter(x["kind"] for x in data["issues"])["Bug"] == 7
assert all(x["status"] and x["resolution"] for x in data["issues"])
assert data["issues"][24]["status"] == "Corrected; no game change"
assert "repeated training confirmations slowed basic progress" not in page
assert [x["n"] for x in data["seasons"]] == list(range(1, 7))
for season in data["seasons"]:
    assert season["w"] + season["dr"] + season["l"] == 18
    assert 3 * season["w"] + season["dr"] == season["pts"]
league = data["league6"]
assert len(league) == 18
assert sum(3 if x[3] > x[4] else int(x[3] == x[4]) for x in league) == 49
assert (sum(x[3] for x in league), sum(x[4] for x in league)) == (86, 15)
cup = data["cup6"]
assert len(cup) == 5 and all(x[2] > x[3] for x in cup)
assert (sum(x[2] for x in cup), sum(x[3] for x in cup)) == (39, 0)
print("PASS: 30 findings, six seasons, D1 and cup scores, jump links, and standalone assets.")
