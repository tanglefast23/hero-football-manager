# Match Presentation & Superpower Design Research

**For:** Hero Football Manager — a 2D top-down soccer sim where players have superpowers (super speed, super strength, fire abilities) that trigger during auto-played matches.

**Purpose:** Survey how mobile-friendly soccer/sports games present simulated matches and special abilities, so we can design a match viewer that is watchable in a few minutes, readable on a phone, and makes superpowers feel exciting without breaking the flow of an auto-played match.

**Method:** Web research across official wikis (Fandom/wiki.gg), professional reviews (Pocket Gamer, Nintendo Life, TouchArcade, GamesRadar+, Destructoid, TheSixthAxis, Gamingbolt, and others), developer interviews, App Store/Steam reviews, and community forums (Sports Interactive forums, Reddit, GameFAQs). Kairosoft and some indie titles publish no official design documentation, so a handful of figures below are reviewer-estimated rather than exact — flagged inline where that's the case.

---

## Part 1: Game-by-Game Findings

### 1. Pocket League Story 1 & 2 (Kairosoft)

**Camera and match length.** Matches play out in an isometric view showing small pixel-art players running around a full pitch, with a scoreboard, player-name list, and a strategy button overlaid on the HUD ([Pocket Gamer review](https://www.pocketgamer.com/pocket-league-story/review/)). Pocket League Story 2 halves are precisely documented at **45 real seconds each (~90 seconds total)** ([Pocket Gamer PLS2 review](https://www.pocketgamer.com/pocket-league-story-2/review/); [GameplayInside guide](https://www.gameplayinside.com/android/pocket-league-story-2-starter-guide/)); the original PLS1 is only loosely described as "a couple of minutes" to "three or four minutes." **Neither game offers a skip or instant-result button** — a frequently repeated complaint in user reviews.

**What the player does mid-match.** This is mostly passive with two real levers: a strategy toggle (Normal / Short Pass / Long Ball, each favoring different player stats) selectable at stoppages, and — the closest thing to a superpower mechanic in this whole survey — **Aura**. Every player has an individual gauge that fills through team facility use and partly refills when a player is knocked down; the team's Support stat speeds this up. When ready, tapping that player's name in the HUD instantly activates a visible flame effect around them, boosting speed, kick power, pass accuracy, and tackle resistance ([wiki.gg](https://kairosoft.wiki.gg/wiki/Pocket_League_Story)). Guides describe active play as "hammering the player names constantly" to catch the exact moment a gauge fills ([Pocket Gamer beginner's guide](https://www.pocketgamer.com/pocket-league-story/a-beginners-guide-to-kairosofts-football-manage-em-up-pocket-league-story/)). Aura auto-deactivates the instant *either* team scores. PLS2 adds a second, purely passive layer: equippable Common/Rare Skills (stat boosts, weather bonuses, cosmetic transformations) that don't fire mid-match at all — they're just always-on modifiers.

**Goals and comebacks.** A goal triggers a dedicated "Goal" interstitial screen that reviewers and players complain runs long (~10 seconds) relative to the tiny match length. There's no real-time comeback mechanic; instead, both games apply a **post-match "grudge" system** — beat a team by too large a margin and they get stronger for the rematch, which guides frame as something to actively avoid rather than a comfort mechanic ([wiki.gg Tips](https://kairosoft.wiki.gg/wiki/Tips_(Pocket_League_Story_2))). No stat-to-outcome formula has ever been published; reviewers agree raw team-quality gap dominates results, with Aura timing and strategy fit as secondary modifiers.

**Relevance to HFM:** Aura is the closest direct precedent in this entire survey for "passive charge, manual tap-to-fire, during an otherwise simulated match" — worth studying closely.

---

### 2. Inazuma Eleven series (the reference for superpower soccer)

**Classic era (DS/3DS trilogy through GO).** Every hissatsu (special move) draws from a shared team **TP pool** (~100 at a time, growing with team level); cheap moves cost ~20-40 TP, fully evolved "ultimate" moves can cost up to ~85-99 TP — nearly the whole bar in one shot ([Inazuma Eleven Wiki](https://inazuma-eleven.fandom.com/wiki/Hissatsu_technique)). Moves are **player-selected from a menu**, not automatic: whenever an attacker and defender collide, the match pauses into a discrete 1-on-1 "duel" where you explicitly pick an action, RPG-battle style ([Nintendo World Report](https://www.nintendoworldreport.com/hands-on-preview/25616/inazuma-eleven-nintendo-ds)). Moves level up automatically through repeated use (three tiers of evolution), and new ones are learned via consumable "manual" items. A full 11-a-side match plays in **about five real minutes**; 4-a-side matches run about a minute ([Nintendo World Report](https://www.nintendoworldreport.com/hands-on-preview/25616/inazuma-eleven-nintendo-ds)).

**Readability.** Every hissatsu gets its own short, distinct cutscene animation plus an on-screen name banner ("Special Move: [name]"), so the viewer always knows exactly what just happened even amid chaotic effects ([Nintendo Life](https://www.nintendolife.com/reviews/2011/03/inazuma_eleven_ds)).

**Clash resolution — the single most important mechanic for this project.** Goals are **not** a one-shot binary. Goalkeepers have a **Keeper Power (KP)** stat that works like a hit-point bar: every save subtracts the shot's power from KP, and a goal only goes in once a shot's power exceeds whatever KP is left ([Inazuma Eleven Wiki](https://inazuma-eleven.fandom.com/wiki/Keeper_Power); confirmed for the newest game by [RPGamer](https://rpgamer.com/review/inazuma-eleven-victory-road-review/)). This means a single opposing super-move rarely ends a match outright — it wears the keeper down rather than humiliating them in one hit. If both sides use a hissatsu simultaneously, "the skills compete, with one coming out on top" rather than simply adding numbers.

**Elemental balance.** Moves and characters carry one of four cyclical elements — **Wind beats Mountain, Mountain beats Fire, Fire beats Forest, Forest beats Wind** — plus a neutral fifth (Void) for outliers ([Inazuma Eleven Wiki — Elements](https://inazuma-eleven.fandom.com/wiki/Elements)). This gives "fire" a clean mechanical identity (strong vs. Forest, weak vs. Mountain) rather than just being a visual skin.

**Newest entry — Victory Road (2023/2025), directly relevant to an auto-played match.** The individual TP system was replaced with a **shared team Tension pool** (spent only at defined contact windows: Focus, Zone, Scramble) plus a **per-player Hype Gauge** that scales a move's power and success chance. Critically, Victory Road ships a first-party **Commander Mode that auto-plays entire matches** while the player watches from chosen camera angles ([official site](https://www.inazuma.jp/victory-road/en/competition/)) — and players have found they can still shape the AI's move choices by **reordering each character's hissatsu priority list**, a useful precedent for exposing "AI behavior settings" without full manual control ([Vortex Gaming](https://vortexgaming.io/en/postdetail/608544)). Near the goal, time visibly slows down (the "Zone" mechanic) specifically so both sides can register decisions before they happen — a deliberate legibility device, not just a power fantasy beat. A goalkeeper's fully-charged Hype Gauge is explicitly what "triggers the most powerful version with dramatic animations" — the game reserves its flashiest cutscenes for genuinely high-stakes moments rather than firing full spectacle on every play ([Operation Sports](https://www.operationsports.com/how-special-moves-work-in-inazuma-eleven-victory-road/)).

**Design philosophy, from the source.** Series creator Akihiro Hino has said outright the games were never meant to simulate real soccer — the goal was "to recreate the thrill of shonen manga," embracing things that look "completely crazy to adults" because the audience wants to see flying kicks and giant energy hands ([Pocket Gamer interview](https://www.pocketgamer.com/inazuma-eleven-3-bomb-blast-lightning-bolt/never-played-inazuma-eleven-heres-level-5-president-akihiro-hino-to-catch-you-up/)).

---

### 3. New Star Soccer (+ New Star Manager)

**The "key moments only" model.** Ordinary play is resolved as running text commentary; the instant the ball reaches your player or a scoring/tackling chance appears, the game cuts to an interactive mini-game. Pocket Gamer: "When the ball reaches the player, the game switches to an interactive top-down view for decision-making: thread through balls, smash the footy towards goal, or try to nip in and intercept" ([Pocket Gamer review](https://www.pocketgamer.com/new-star-soccer/review/)). Whether you get *any* key moments at all in a given match is itself gated by a relationship stat — a low manager relationship benches you as a reserve.

**Camera.** A two-stage choreography: chances start from a top-down view where you drag back to set power and direction (Angry-Birds-style), then release cuts to a **tight, ball-focused first-person view** for a single follow-up tap that sets curl/finish ([Macworld](https://www.macworld.com/article/666864/new-star-soccer-for-ios-review.html)). The split exists specifically so the hard part (aim) is one gesture and the finishing input is a single low-precision tap — deliberately thumb-friendly.

**Dramatization.** Goals get watchable replays and crowd/cameraman reactions; celebration is itself a mechanical choice (run to the bench to repair your manager relationship, celebrate with teammates for team standing, or showboat for fans/personal fame) — the "big moment" doubles as a resource-allocation decision ([TouchArcade](https://toucharcade.com/games/new-star-soccer)).

**Energy and relationships.** A single energy pool is drained by training, socializing, *and* playing matches, forcing constant tradeoffs; running low causes poor performance and injury risk. Multiple relationship meters (Boss, Team, Fans, sponsors, partner) are each fed by specific in-match actions (goals → Boss, assists → Team, chances created → Fans) and directly gate whether you're selected to play at all next match — relationship management is not just flavor, it controls access to gameplay.

**Anti-frustration.** No confirmed in-match comeback/rubber-banding system exists. Instead, softening comes from structure: performance feeds gradual multi-match meters rather than instant pass/fail, and a bad game is a small fraction of a multi-season career arc. Notably, the studio's later game **New Star Manager added an explicit (if "significantly restricted") replay/undo tool** that the original lacked — a sign the studio recognized the gap ([Jump Dash Roll](https://www.jumpdashroll.com/article/new-star-manager-review)).

---

### 4. Retro Bowl (the gold standard of mobile management + match balance)

**Division of control.** The player controls only **one role at a time** — the ball carrier — via a single drag gesture (pull back = direction + power; a second-finger tap adds a faster "bullet" pass). **Blocking, the entire defense, and route-running are fully automated**, driven purely by stat ratings ([Wikipedia](https://en.wikipedia.org/wiki/Retro_Bowl); [Rob's Complete Guide](https://robwritesaboutwhatever.com/2021/04/27/robs-complete-guide-to-retro-bowl-winning-football-games/)). This is the core simplicity trick: instead of simulating 22 players' decisions, the game gives the player total tactile control over exactly one thing at a time and collapses everything else into stat-driven auto-resolution.

**Length and pacing.** A full game is 4 quarters at a player-chosen length (1/2/3 minutes each; 2 is default), putting a full game at **roughly 4-12 real minutes** (~8 min typical) ([Retro Bowl Wiki](https://retro-bowl.fandom.com/wiki/Quarters)). Crucially, there's a **per-game Sim-vs-Play choice** — tap "Sim" instead of "Play" to resolve any single game instantly via CPU simulation, without a bulk "sim the whole season" button, which keeps the season loop present without forcing full manual play of every fixture ([Explosion of Fun](https://explosionoffun.com/how-to-sim-games-in-retro-bowl/)). An optional **Dynamic difficulty** setting (1-16 scale) auto-adjusts opponent strength based on recent win/loss record to keep a long season from becoming a one-sided streak.

**Camera.** A retro pixel-art, elevated overhead field view (Tecmo Bowl lineage) shows the whole field and both lines of players at once — legible at a glance without scrolling. A "Cam Zoom" toggle tightens the frame around the ball carrier during plays.

**Why it feels good — in the developer's own words.** Creator Simon Read has defended restraint explicitly: "I feel that the game is at a point where adding major new features risks upsetting the balance of the game and the simplicity that has brought it success" — deliberately resisting pressure to add online play, playable defense, or full rosters ([PocketGamer.biz](https://www.pocketgamer.biz/new-star-games-simon-read-retro-bowl-making-of/)). GamesRadar+ frames the same idea from the outside: "a near-flawless understanding of what is essential and what can be left out — you only control the players you have to, when you have to — which puts a tight focus on the action and makes every play feel important" ([GamesRadar+](https://www.gamesradar.com/retro-bowls-addictive-simplicity-makes-it-one-of-the-best-sports-games-in-recent-years/)).

**Dramatization and stats.** A large on-screen **"TOUCHDOWN!!!"** banner marks scores — TheSixthAxis calls it "truly crushing" from the losing side's perspective ([TheSixthAxis](https://www.thesixthaxis.com/2022/02/11/retro-bowl-review-switch-pc-android/)). Injuries get a dedicated post-game reveal screen naming the body part and recovery time. Stats set probability and tolerance for error (QB Accuracy lowers interception risk, Arm Strength caps range and fatigues over the game, WR Catching reduces drops under pressure), while the manual drag-aim gesture is the visible skill layer riding on top — a human player can "throw a receiver open" regardless of the underlying odds on a worse throw.

---

### 5. Mario Strikers (Battle League / Charged) and Captain Tsubasa: Rise of New Champions — making powers *readable*

These two are the most directly useful precedents for "how do you make an over-the-top superpower legible in a fast match."

**Mario Strikers: Battle League — the Hyper Strike.** A glowing "Strike Orb" spawns on the field; touching it hypes the *whole team* for a 20-second window. Within that window, holding the shoot button charges a shot — but the charging player is **visibly vulnerable and can be tackled or hit by an item to cancel the move outright**, which is the primary counterplay tool ([Game8](https://game8.co/games/Mario-Strikers-Battle-League/archives/378444)). Once locked in, the screen shifts into a cel-shaded comic-book art style, slows down, and cuts through **three sequential freeze-frame close-ups** of the character's face before the named move plays out (Fire Cyclone, Flame Cannon, etc.). The defending player gets a real interactive counter: mash a button to fill a block gauge beside the goalkeeper — a stronger, better-timed strike requires more successful presses to stop, and a good block stuns the keeper only briefly, creating a loose-ball scramble rather than a clean turnover. Reviewers flagged the downside directly: the cutscene is unskippable and, because each character has only one canned animation, it "wears thin" with repetition ([Nintendo World Report](https://www.nintendoworldreport.com/review/60747/mario-strikers-battle-league-switch-review)).

**Captain Tsubasa: Rise of New Champions.** Runs on two personal bars (Spirit = stamina, drains on dashing/tackling/using any special) plus a Shot Gauge charged by holding the shoot button while dribbling. The camera choreography is the clearest example in this survey of "cheap normal-play camera, expensive spectacle camera": ordinary play uses a lateral broadcast-style side camera, and any standout play — not just goals, also a successful two-dodge chain — triggers **a tight character close-up that fills the screen**, then a named, multi-second animated sequence (Tsubasa's shot arcs over players' heads; Hyuga's summons a tiger image that slams into the goal) ([Nintendo World Report](https://www.nintendoworldreport.com/review/54876/captain-tsubasa-rise-of-new-champions-switch-review)). Crucially, **an in-fiction 30-minute half compresses into about five real minutes**, and Nintendo World Report's own summary of the pacing logic is the cleanest one-line design principle in this whole survey: *"only the shots and goals are especially flashy; the rest of it is just fast soccer."* Clash resolution again avoids one-shot outcomes — goalkeepers have their own Spirit meter that depletes by a variable amount per save, with named passive thresholds (one keeper's saves become unreliable below 20% Spirit; another stays reliable above 50%) — layered with a genuine timing-input "Super Save" that consumes a team-wide V-Zone gauge if triggered at the exact right moment.

**Shared lesson.** Both games separate the *readable gameplay camera* from the *spectacle camera* entirely, and both gate spectacle behind a multi-stage telegraph: visible resource pickup or gauge fill → an interruptible charge window → an unmistakable scripted cutscene. Both were criticized by reviewers for the same failure mode when pushed too hard: unskippable, repetitive cutscenes.

---

### 6. Football Manager Mobile and Soccer Manager — instant result vs. watchable simulation

**Football Manager Mobile.** Ships two camera modes — **Full** (a top-down 2D pitch with players shown as colored dots, nicknamed "blobs" by the community since Championship Manager 4 in 2003) and **Commentary Only** (pure text, no pitch graphic) — plus, independently, an **Extended Highlights vs. Key Moments** density toggle ([SI Games Manual](https://community.sports-interactive.com/sigames-manual/football-manager-mobile-2026/match-day-r5263/)). Interestingly, FM Mobile still has **no true one-tap "Instant Result" button** — that only arrived on PC/console in late 2025 — and Mobile's long-standing workaround ("go on holiday" for a day and let the assistant manager play it) is one of the most persistently requested missing features on the developer's own forums, with players explicitly saying "I enjoy setting up teams, tactics and finances, but aren't big fans of watching the games" ([SI Community](https://community.sports-interactive.com/forums/topic/587660-instant-result-in-football-manager-2025-mobile/)). Goals get a toggleable replay with an adjustable replay-speed slider; other key events (injuries, etc.) surface as pop-up alerts rather than cinematic treatment. The underlying attribute-to-outcome formula has **never been published**; the community's best reverse-engineered theory proposes separate "attempt" and "execution" probability rolls per action, but even its authors say "none of us have any concrete evidence, we can only make guesses" ([FM-Arena](https://fm-arena.com/thread/16007-understanding-the-match-engine-are-meta-tactics-and-meta-attributes-the-cause-or-consequence-of-imbalances/)).

**Soccer Manager (SMG series).** Takes the opposite abstraction bet — animated 3D player models on a rendered pitch rather than 2D dots, with a 2025 "Match Motion" update adding 300+ new context-driven animations. The results are instructive: an independent review of Soccer Manager 2026 found "players constantly fall over in a slapstick fashion whenever they get tackled," goalkeepers that "teleport to save shots," and confirmed the **offside rule isn't implemented at all**, scoring it 2/5 ([Fuller FM](https://fullerfm.com/2025/11/05/review-soccer-manager-2026/)). Speed-control tooling is thinner and less documented than FM's.

**Why abstraction wins on mobile — the key design argument.** A VideoGamer retrospective makes the sharpest case for *why* FM's "ugly" 2D dots persist: realistic 3D rendering makes every engine quirk glaringly obvious ("a player surging into the box, turning away from goal, and passing back 90 meters immediately shatters believability in 3D"), whereas "a small 2D shape having a strange moment doesn't break immersion" the same way ([VideoGamer](https://www.videogamer.com/features/why-football-manager-will-always-be-about-the-blobs/)). Soccer Manager's reception seems to prove the thesis by accident: its more ambitious 3D presentation draws exactly the kind of immersion-breaking criticism 2D abstraction structurally can't produce, because a colored dot has no anatomy to glitch.

---

## Part 2: Cross-Game Synthesis

### Match length and pacing tricks

| Game | Real-time length | Main pacing tool |
|---|---|---|
| Pocket League Story 2 | ~90 sec (2×45s halves) | Just made short; no skip exists (frequently complained about) |
| Inazuma Eleven (classic, 11-a-side) | ~5 min | Matches are short by design; no skip needed |
| Inazuma Eleven: Victory Road | Variable | First-party full-match auto-play (Commander Mode) |
| Captain Tsubasa: RoNC | ~5 min (30 in-fiction min compressed) | Spectacle gated to goals/standout plays only; rest is "just fast soccer" |
| Retro Bowl | ~4-12 min (8 min default) | Per-game Sim-vs-Play toggle; adjustable quarter length |
| New Star Soccer | A handful of key moments; rest is text | Structural — only your own decisive touches are ever played |
| FM Mobile | Full / Extended / Key Highlights / Commentary-only | Density toggle; no true one-tap instant result yet |
| Soccer Manager | Not clearly documented | Reviewer-reported default pace already feels "too fast" |

Takeaway: every successful title in this set keeps a *watched* match under roughly five to eight real minutes, and every title gives the player *some* lever to shorten or skip a less important match. None of the well-regarded titles force a full-length simulated broadcast.

### Camera and viewpoint for phone readability

Two consistent patterns emerge:

1. **A cheap, wide, static "readability" camera for ordinary play** — top-down or high elevated angle, full pitch or close to it, no player-controlled panning (Pocket League Story's isometric view, Retro Bowl's overhead pixel view, FM Mobile's 2D dots, Captain Tsubasa's lateral broadcast cam). This is what lets the whole board state be read at a glance on a small screen.
2. **A separate, expensive "spectacle" camera reserved for special moments** — tight character close-ups, freeze-frames, cel-shaded or slow-motion treatment, cutting away from the live match entirely (Mario Strikers' Hyper Strike, Captain Tsubasa's named-shot cutscenes, Inazuma Eleven's Zone bullet-time and cutscene banners). Nobody tries to render a superpower legibly *inside* the normal gameplay camera — they cut to a different one.

### How goals and big moments are dramatized

Common toolkit across games: a **named on-screen callout or banner** ("Special Move: X," "TOUCHDOWN!!!"), a **short replay** (FM's speed-adjustable goal replay, New Star Soccer's replay), **freeze-frames or slow motion** during the buildup (Mario Strikers' three-panel zoom, Inazuma Eleven's Zone slowdown), and **crowd/cameraman reaction shots** (New Star Soccer). The one clear anti-pattern, called out independently in reviews of *three different games* (Pocket League Story's 10-second goal screen, Mario Strikers' unskippable Hyper Strike cutscene, Captain Tsubasa's unskippable named-move animations): **an unskippable celebration or spectacle sequence becomes a complaint once the novelty wears off**, no matter how good it looks the first ten times.

### Ability activation models

| Model | Examples | Notes |
|---|---|---|
| Fully passive (stat-only, no trigger) | Pocket League Story's Skills, FM/Soccer Manager attributes | No player agency; power is "baked in" before the match starts |
| Fully manual, execution-based | Retro Bowl's throw/run, New Star Soccer's aim-and-tap | Player physically performs the action; stats set tolerance/odds, not the outcome directly |
| Passive charge + manual trigger (hybrid) | **Pocket League Story's Aura** (closest analog to HFM's design), Mario Strikers' Hyper Strike, Captain Tsubasa's Shot/V-Zone gauges | Meter fills through play; player taps at the moment of their choosing within a window |
| Contact-triggered menu choice | Inazuma Eleven classic hissatsu, Victory Road's Focus/Zone/Scramble | Fires only at defined collision/proximity windows, not freely at any time |
| AI-directed with player-configurable priorities | Inazuma Eleven: Victory Road Commander Mode | Player pre-sets *when/what* the AI should prefer, then watches it execute — the closest precedent for an auto-played match with configurable ability logic |

Every hybrid/manual model shares two design features worth copying: (a) **the charge window is visible** (a bar, a glow, a name-tag prompt), and (b) **the charging or firing player is briefly vulnerable to interruption**, so an opponent has a real counterplay option rather than just watching helplessly.

### Anti-frustration and comeback design

No game in this survey uses true real-time rubber-banding (a hidden "losing team gets better plays" boost). Instead, the toolkit is:
- **Attrition instead of one-shot kills**: Inazuma Eleven's Keeper Power and Captain Tsubasa's goalkeeper Spirit both turn "the opponent used a superpower on me" into "my keeper got weakened," not "I instantly conceded" — the single most importable idea from this whole survey.
- **Resource cost on the attacker after a successful power**: Victory Road's Knockout mechanic burns the *attacking* team's Tension even on a goal, and Captain Tsubasa's V-Zone Super Save spends a full gauge — meaning the team that just got scored on faces an opponent who is temporarily depleted, which is a built-in cooldown rather than a buff for the loser.
- **Item/pickup skew toward the losing side**: Mario Strikers' Mario-Kart-style item bias, without an equivalent to Mario Kart's "blue shell" that specifically punishes the leader.
- **Season/meter-level forgiveness rather than match-level forgiveness**: New Star Soccer and Retro Bowl both let a single bad match nudge a multi-game meter (relationship stats; Dynamic difficulty) instead of being instantly punishing, so one loss doesn't spiral a career.
- **A clear anti-pattern to avoid**: Pocket League Story's post-blowout "grudge" system (opponents get stronger after you win by too much) was read by reviewers as an added frustration, not a comfort — it punishes the winning player rather than helping the losing one.

### Stat-to-outcome mapping

Two philosophies recur:
1. **Hidden dice roll, stats set the odds** (FM/Soccer Manager, Pocket League Story) — no visible mechanic, the player never sees "why" a play succeeded or failed, and this is exactly what community reverse-engineering threads exist to complain about.
2. **Visible skill/timing layer on top of stat-set tolerance** (Retro Bowl's drag-aim, New Star Soccer's aim-then-curl, Mario Strikers' two-tap Hyper Meter timing) — the player (or, for an auto-played match, the "camera") gets to *see* the mechanism, which reads as fairer even when the underlying math is similar. Retro Bowl's QB Accuracy stat is a clean example: it doesn't decide pass success directly, it "reduces bad throws, improves timing windows, and lowers interception risk" — narrowing the margin for error around a visible action rather than rolling dice invisibly.

---

## Part 3: Recommendations for Hero Football Manager

Design target: a 2D top-down, **3-6 real-minute watchable match**, auto-played by default, with **hybrid superpower activation** — powers charge passively through match events, and the player can optionally tap to fire one at the moment they judge best.

1. **Use a cheap top-down "readability" camera for all ordinary play, and reserve a separate zoomed-in "spectacle" camera exclusively for power activation.** Every game surveyed does this — nobody tries to render a superpower legibly inside the normal wide shot. Cut to the tighter camera only for the 1-2 seconds a power is charging and firing, then cut straight back. (In practice: this means the code path for "normal match tick" and "power resolution" can stay almost entirely separate, which also makes the power sequence easier to build and test on its own.)

2. **Give every power a visible charge meter tied to a specific player, filled by good in-match play — not a timer.** Pocket League Story's Aura (fills from facility use and getting knocked down) and Captain Tsubasa's Shot Gauge (fills from dribbling/dashing) both tie charge rate to what's happening on the pitch, so the meter feels earned rather than arbitrary. Fire ability charging faster after a good tackle, or super-strength charging faster after winning physical duels, reinforces the fantasy mechanically, not just visually.

3. **Make the charge-to-fire window a few seconds long and visibly telegraphed, and let the opponent interrupt it.** Mario Strikers' Hyper Strike is cancelable by a tackle during the wind-up — this single rule is what stops "who has more powers" from feeling like an unstoppable snowball. A glowing aura, a rising meter, or a name-tag pulse are all cheap, readable "this is about to happen" signals that give the defending side (AI or player) a fair chance to react before the power actually lands.

4. **Resolve power-vs-power and power-vs-defense as attrition, not a coin flip.** Borrow Inazuma Eleven's Keeper Power model directly: give goalkeepers (and maybe key defenders) a depleting "resolve" stat that a super-shot damages rather than instantly beats. This means a single fire-powered strike from the opponent weakens your defense instead of ending the match outright — the single highest-leverage anti-frustration idea in this whole survey, and it directly answers "what happens when the CPU uses a power on me."

5. **Post a short, unmistakable on-screen callout every time a power fires — a name and an icon, not just a particle effect.** Inazuma Eleven's "Special Move: [Name]" banner and Retro Bowl's "TOUCHDOWN!!!" both solve the same problem: in a fast, busy match, the player needs one glance to know *what just happened*, especially since HFM's matches are auto-played and the player may not have been staring at the exact pixel where the power triggered.

6. **Keep spectacle sequences short and always skippable after the first viewing.** Three separate games in this survey (Pocket League Story, Mario Strikers, Captain Tsubasa) were criticized by reviewers for the exact same mistake: a great cutscene the first few times becomes a tedium complaint by the twentieth. Cap any power's cinematic beat at 2-3 seconds, and add a tap-to-skip after the player has seen that specific power once or twice.

7. **Target the low end of the observed real-time range: aim for matches around 3-4 minutes, not 6.** Every well-regarded comparable clusters around five minutes or less when it isn't a full manual-control game (Pocket League Story 2: 90 seconds; Inazuma Eleven and Captain Tsubasa: ~5 minutes; Retro Bowl: ~8 minutes only because quarters are player-adjustable). Since HFM matches are auto-played rather than manually played shot-by-shot, err toward the shorter end — there's less for the player to actively do per minute than in a Retro Bowl or New Star Soccer match, so padding the runtime will read as slower, not richer.

8. **Give the player a pre-match or in-match "priority" setting for AI power usage, instead of (or alongside) manual tapping.** Inazuma Eleven: Victory Road's Commander Mode auto-plays matches but still lets players reorder each character's move priority list beforehand — this is the cleanest existing precedent for "auto-played match, but the player still shaped how powers get used." For HFM, this could mean a simple toggle per player: "save power for clutch moments" vs. "use as soon as ready," satisfying players who don't want to tap in real time.

9. **Make the manual tap-to-fire input itself simple and single-gesture, with a short, forgiving hit window rather than frame-perfect timing.** New Star Soccer and Retro Bowl both succeed by needing exactly one deliberate gesture per key moment (drag-aim, or a single tap), not a multi-step combo. Since powers are optional in the hybrid model, a single, generous tap window (a highlighted 1-2 second zone in the charge meter) keeps the feature accessible without turning the match into a rhythm-game.

10. **Punish the winner, not the loser, if you want a difficulty-scaling safety net — and prefer season-level over match-level correction.** Pocket League Story's "beat them by too much and they get stronger next time" was read as a frustration, not a comfort, because it fires immediately after a good match. Retro Bowl's Dynamic difficulty (a slow 1-16 scale adjusting over a season based on overall record) and New Star Soccer's multi-match relationship meters are the better model: let one bad — or one great — match nudge a slow-moving average rather than instantly reversing the next fixture's odds.

---

## Sources

**Pocket League Story 1 & 2**
- [Pocket League Story Review — Pocket Gamer](https://www.pocketgamer.com/pocket-league-story/review/)
- [A beginners' guide to Pocket League Story — Pocket Gamer](https://www.pocketgamer.com/pocket-league-story/a-beginners-guide-to-kairosofts-football-manage-em-up-pocket-league-story/)
- [Pocket League Story 2 Review — Pocket Gamer](https://www.pocketgamer.com/pocket-league-story-2/review/)
- [Pocket League Story Review — TouchArcade](https://toucharcade.com/2012/01/09/pocket-league-story-review/)
- [Pocket League Story Review / Walkthrough — Gamezebo](https://www.gamezebo.com/walkthroughs/pocket-league-story-walkthrough/)
- [Review: Pocket League Story (Switch) — Digitally Downloaded](https://www.digitallydownloaded.net/2019/05/review-pocket-league-story-nintendo.html)
- [Pocket League Story for Nintendo Switch – Review — eShopper Reviews](https://eshopperreviews.com/2024/07/12/pocket-league-story-for-nintendo-switch-review/)
- [Pocket League Story 2 – Walkthrough/Review — JayIsGames](https://jayisgames.com/review/pocket-league-story-2.php)
- [Pocket League Story 2 Starter Guide — GameplayInside](https://www.gameplayinside.com/android/pocket-league-story-2-starter-guide/)
- [Pocket League Story Guide — Esports News UK](https://esports-news.co.uk/2013/04/05/pocket-league-story-guide/)
- [The Kairosoft Wiki — Pocket League Story](https://kairosoft.wiki.gg/wiki/Pocket_League_Story) / [PLS2](https://kairosoft.wiki.gg/wiki/Pocket_League_Story_2) / [Skills (PLS2)](https://kairosoft.wiki.gg/wiki/Skills_(Pocket_League_Story_2)) / [Tips (PLS2)](https://kairosoft.wiki.gg/wiki/Tips_(Pocket_League_Story_2))

**Inazuma Eleven**
- [Hissatsu technique — Inazuma Eleven Wiki](https://inazuma-eleven.fandom.com/wiki/Hissatsu_technique)
- [Elements — Inazuma Eleven Wiki](https://inazuma-eleven.fandom.com/wiki/Elements)
- [Keeper Power — Inazuma Eleven Wiki](https://inazuma-eleven.fandom.com/wiki/Keeper_Power)
- [Knockout — Inazuma Eleven Wiki](https://inazuma-eleven.fandom.com/wiki/Knockout)
- [How Special Moves Work In Inazuma Eleven: Victory Road — Operation Sports](https://www.operationsports.com/how-special-moves-work-in-inazuma-eleven-victory-road/)
- [Focus, Zone, or Scramble? — Operation Sports](https://www.operationsports.com/focus-zone-scramble-inazuma-eleven-victory-road-systems-explained/)
- [Inazuma Eleven: Victory Road Review — RPGamer](https://rpgamer.com/review/inazuma-eleven-victory-road-review/)
- [Review: Inazuma Eleven: Victory Road — Siliconera](https://www.siliconera.com/review-inazuma-eleven-victory-road-is-packed-with-experiences/)
- [Inazuma Eleven Review (DS) — Nintendo Life](https://www.nintendolife.com/reviews/2011/03/inazuma_eleven_ds)
- [Inazuma Eleven Hands-on Preview — Nintendo World Report](https://www.nintendoworldreport.com/hands-on-preview/25616/inazuma-eleven-nintendo-ds)
- [COMPETITION MODE — Inazuma Eleven: Victory Road (official)](https://www.inazuma.jp/victory-road/en/competition/)
- [Never played Inazuma Eleven? Akihiro Hino explains — Pocket Gamer](https://www.pocketgamer.com/inazuma-eleven-3-bomb-blast-lightning-bolt/never-played-inazuma-eleven-heres-level-5-president-akihiro-hino-to-catch-you-up/)
- [Secrets to Skyrocketing AI Auto-Battle Win Rate — Vortex Gaming](https://vortexgaming.io/en/postdetail/608544)

**New Star Soccer / New Star Manager**
- [New Star Soccer — Wikipedia](https://en.wikipedia.org/wiki/New_Star_Soccer)
- [New Star Soccer Review — Pocket Gamer](https://www.pocketgamer.com/new-star-soccer/review/)
- [Simon Read interview — Pocket Gamer](https://www.pocketgamer.com/new-star-soccer/new-star-soccer-creator-simon-read-on-how-his-smartphone-sim-transcends-the-trad/)
- [New Star Soccer for iOS Review — Macworld](https://www.macworld.com/article/666864/new-star-soccer-for-ios-review.html)
- [New Star Soccer Review — 148Apps](http://www.148apps.com/reviews/star-soccer-review/)
- [New Star Soccer 5 Review — A Force For Good](https://forceforgood.co.uk/sport/new-star-soccer-5/)
- [New Star Soccer game hub — TouchArcade](https://toucharcade.com/games/new-star-soccer)
- [New Star Manager Review — Fuller FM](https://fullerfm.com/2020/02/05/review-new-star-manager/)
- [New Star Manager Review — Jump Dash Roll](https://www.jumpdashroll.com/article/new-star-manager-review)

**Retro Bowl**
- [Retro Bowl — Wikipedia](https://en.wikipedia.org/wiki/Retro_Bowl)
- [How Retro Bowl went from a simple RPG to a number one sports game — PocketGamer.biz](https://www.pocketgamer.biz/new-star-games-simon-read-retro-bowl-making-of/)
- [Retro Bowl's addictive simplicity — GamesRadar+](https://www.gamesradar.com/retro-bowls-addictive-simplicity-makes-it-one-of-the-best-sports-games-in-recent-years/)
- [Retro Bowl Review — TheSixthAxis](https://www.thesixthaxis.com/2022/02/11/retro-bowl-review-switch-pc-android/)
- [Review: Retro Bowl (Switch) — Nintendo Life](https://www.nintendolife.com/reviews/switch-eshop/retro-bowl)
- [Gameplay / Quarters / Cam Zoom / Morale — Retro Bowl Wiki](https://retro-bowl.fandom.com/wiki/Gameplay)
- [Rob's Complete Guide to Retro Bowl](https://robwritesaboutwhatever.com/2021/04/27/robs-complete-guide-to-retro-bowl-winning-football-games/)
- [Retro Bowl Stats Explained — RetroBowl25](https://retrobowl25.games/retro-bowl-stats-explained)
- [How to Sim Games in Retro Bowl — Explosion of Fun](https://explosionoffun.com/how-to-sim-games-in-retro-bowl/)
- [Retro Bowl Best Difficulty Setting — Gamers Decide](https://www.gamersdecide.com/articles/retro-bowl-best-difficulty-setting)

**Mario Strikers / Captain Tsubasa: Rise of New Champions**
- [Hyper Strike — Super Mario Wiki](https://www.mariowiki.com/Hyper_Strike)
- [How to Do a Hyper Strike — Game8](https://game8.co/games/Mario-Strikers-Battle-League/archives/378444)
- [Mario Strikers Charged — Wikipedia](https://en.wikipedia.org/wiki/Mario_Strikers_Charged)
- [Review: Mario Strikers: Battle League — Destructoid](https://www.destructoid.com/reviews/review-mario-strikers-battle-league/)
- [Mario Strikers: Battle League Review — Nintendo World Report](https://www.nintendoworldreport.com/review/60747/mario-strikers-battle-league-switch-review)
- [CAPTAIN TSUBASA: RISE OF NEW CHAMPIONS Gameplay description — Bandai Namco](https://en.bandainamcoent.eu/captain-tsubasa/news/captain-tsubasa-rise-of-new-champions-gameplay-description)
- [Beginner's guide — PlayStation Blog](https://blog.playstation.com/2020/08/28/beginners-guide-to-captain-tsubasa-rise-of-new-champions-out-today/)
- [Captain Tsubasa: Rise of New Champions Review — Gamingbolt](https://gamingbolt.com/captain-tsubasa-rise-of-new-champions-review-tiger-shot)
- [Captain Tsubasa: Rise of New Champions Review — TheSixthAxis](https://www.thesixthaxis.com/2020/08/27/captain-tsubasa-rise-of-new-champions-review/)
- [Captain Tsubasa: Rise of New Champions Switch Review — Nintendo World Report](http://www.nintendoworldreport.com/review/54876/captain-tsubasa-rise-of-new-champions-switch-review)
- [Captain Tsubasa: Rise of New Champions Review — Cubed3](https://www.cubed3.com/games/reviews/nintendo-switch/captain-tsubasa-rise-of-new-champions)

**Football Manager Mobile / Soccer Manager**
- [SI Games Manual — Match Day (FM Mobile 2026)](https://community.sports-interactive.com/sigames-manual/football-manager-mobile-2026/match-day-r5263/)
- [Football Manager 2024 Review (cross-platform) — TouchArcade](https://toucharcade.com/2023/11/14/football-manager-2024-review-touch-vs-mobile-vs-ps5-vs-pc-steam-deck-features-save-controller-console/)
- [Why Football Manager will always be about the blobs — VideoGamer](https://www.videogamer.com/features/why-football-manager-will-always-be-about-the-blobs/)
- [2D Match Engine – poor quality — SI Community](https://community.sports-interactive.com/forums/topic/594339-2d-match-engine-poor-quality/)
- [Instant Result in Football Manager 2025 Mobile — SI Community](https://community.sports-interactive.com/forums/topic/587660-instant-result-in-football-manager-2025-mobile/)
- [Football Manager 26 adds Instant Result option — Operation Sports](https://www.operationsports.com/football-manager-26-adds-instant-result-option-for-matches/)
- [Understanding the match engine — FM-Arena](https://fm-arena.com/thread/16007-understanding-the-match-engine-are-meta-tactics-and-meta-attributes-the-cause-or-consequence-of-imbalances/)
- [A New Matchday Experience in Soccer Manager 2025 — Invincibles Studio](https://invinciblesstudio.com/a-new-matchday-experience-in-soccer-manager-2025/)
- [Review: Soccer Manager 2026 — Fuller FM](https://fullerfm.com/2025/11/05/review-soccer-manager-2026/)

*Note on confidence: most figures above come from reviewer descriptions, official wikis, or developer statements and were cross-checked against at least one independent source where possible. A few precise numbers (e.g., PLS1's exact match length, Soccer Manager's skip speed) are only loosely documented or came from lower-confidence aggregator sites; these are flagged as approximate in the relevant section rather than stated as exact.*
