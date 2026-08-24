# Hero Football Manager — TikTok Creative Playbook

Date: 22 August 2026  
Format: 1080×1920, 9:16 portrait, 30 fps, Rec.709, H.264  
Primary destination: TikTok organic post, then Spark Ad if the organic post wins  
Secondary exports: Instagram Reels and YouTube Shorts without a watermark

## Creative goal

These are not shortened App Store trailers. Each video is one small story with a strong open loop, truthful gameplay, a visible payoff, and one purchase message.

The three videos test different buyer motivations:

1. **Video A — “He Caught Fire”** sells spectacle and immediate curiosity.
2. **Video B — “His Agent Noticed”** sells management depth, humor, and attachment to a player.
3. **Video C — “From Stand-Up to Superpowers”** sells trust through the creator's real story, then uses Video A's strongest gameplay payoff.

All three repeat the four store messages without listing them mechanically:

- Ordinary players can wake up with superpowers.
- The player runs the whole club and watches the plan play out.
- It is one purchase with no ads or in-app purchases.
- It works offline and keeps the career on the device.

## Shared production contract

### TikTok-native structure

- Start on a human problem or impossible event. Do not start on a logo.
- Make the first frame understandable before sound starts.
- Resolve the first open loop by 7–10 seconds.
- Use only real game interfaces and deterministic game outcomes.
- Keep cuts fast, but let the best payoff breathe for at least 0.6 seconds.
- End on one direct action: **Tap to run your club.**

Current TikTok guidance favors honest, process-led material over corporate perfection. The videos should look authored and beautiful, but still feel like a developer showing a surprising game moment.

### Composition and safe area

- Master canvas: `1080×1920`.
- Frame rate: `30 fps`.
- Keep all essential text inside `x=72–900` and `y=170–1560`.
- Reserve the rightmost 180 px for TikTok buttons.
- Reserve the bottom 300 px for the caption and CTA interface.
- Use the TikTok preview tool before export because its safe area changes with caption length and ad format.
- Center existing `886×1920` iPhone footage at native height. Do not stretch it.
- Fill the 97 px side rails with ink-deep `#16121f`, animated palette marks, or a cropped duplicate at 15% opacity. Never use a soft blurred duplicate because it fights the pixel style.

### Visual language

Reuse the game's canonical palette:

- Ink-deep: `#16121f`
- Ink: `#241f2e`
- Cream: `#f4f1ea`
- Blue: `#5a8fd6`
- Blue light: `#a3c8f0`
- Hero gold: `#edb54a`
- Gold light: `#f7d894`
- Red: `#d94f52`
- Flame: `#ff6a00`

Use `HFMSilkscreen_700Bold.ttf` for short labels and display text. Use an ordinary readable sans only for a sentence longer than eight words.

Pixel rules:

- Use integer scale values whenever pixel art is enlarged.
- Use nearest-neighbor sampling.
- Do not blur gameplay, sprites, or the pixel font.
- Use hard-edged shadows and stepped motion.
- Reserve gold for powers, rewards, and the purchase payoff.

### Title system — create this once

**[CREATE ASSET: `ComicStompTitle`]**

This title must look different from the game's normal UI while still belonging to its world.

- Main face: cream or blue.
- Inner highlight: one 2 px cream edge on the upper-left.
- Main outline: 6 px ink.
- First offset shadow: 8 px hero gold, down-right.
- Second offset shadow: 14 px red, down-right.
- Final contact shadow: 18 px ink-deep, down-right.
- No box, ribbon, panel, or rounded rectangle.
- Maximum two lines.
- Slightly compress the bottom line to 96% width so the silhouette feels hand-lettered.

Entrance over 10 frames:

1. Frames 0–2: scale 160%→108%, rotate `-5°→1°`, opacity 0→1.
2. Frames 3–6: scale 108%→96%; the gold and red shadows arrive two frames late.
3. Frames 7–10: scale 96%→100%; rotation settles to zero.
4. On frame 3, emit four 8×8 pixel star chips from the word with 90° paths.
5. Play a short whoosh on frame 0 and a paper/wood impact on frame 3.

Exit over 6 frames:

- Split the words on their horizontal pixel rows.
- Odd rows move 70 px left; even rows move 70 px right.
- Opacity stays solid for four frames, then cuts to zero.
- Pair the exit with a 90 ms digital zipper sound.

### Small caption system

**[CREATE ASSET: `DeveloperNote`]**

- Looks like a developer's quick note, not a game button.
- Silkscreen Bold, 42–54 px.
- Cream type with 4 px ink outline.
- One important word can use gold or red.
- No more than seven words.
- Appears with a two-frame vertical tick: `y+12 → y-3 → y`.
- A 2 px cursor block blinks once after the final word, then disappears.

### Transition system

Use only four transition types across the three videos:

1. **Pixel rewind:** 5–7 reversed source frames, each held twice, with a three-step horizontal tear.
2. **Action match cut:** cut on the ball, a finger tap, or a title impact. No dissolve.
3. **Ink snap:** one frame of ink-deep, one frame of cream, then the new scene.
4. **Paper whip:** the current management screen slides up while the next slides from below, with a 2 px ink seam.

Avoid generic spins, liquid morphs, lens flares, and smooth zoom transitions.

### Audio contract

- The video must make sense muted.
- The ad version must contain audio.
- Target complete master: about `-14 LUFS integrated`, with true peak below `-1 dBTP`.
- Keep music 8–12 dB below the main SFX or voice.
- Duck music 6 dB for every spoken line and 3 dB for power ignition.
- Never stack more than three foreground effects at once.

**[FIND ASSET: swappable music bed]**

Choose music from TikTok's Commercial Music Library on publishing day. Use a current, commercially cleared track with:

- 125–150 BPM.
- A clean first downbeat.
- A small drop or empty half-beat around second 3–4.
- No dense vocals under narration.

Do not bake an expiring trend song into the source composition. Export a music-free master with SFX and voice, plus a version with a temporary guide beat.

### Existing reusable assets

From the game repository:

- Fonts: `assets/fonts/HFMSilkscreen_400Regular.ttf`, `assets/fonts/HFMSilkscreen_700Bold.ttf`
- Icon: `assets/icon.png` — Caped Ball
- Fire: `assets/audio/sfx/fire-torch-ignite.wav`
- Flame rise: `assets/audio/sfx/flame-up.wav`
- Flame hit: `assets/audio/sfx/flame-hit.wav`
- Fire shot: `assets/audio/sfx/shot-scorch.wav`
- Goal impact: `assets/audio/sfx/goal-net-hit.wav`
- Goal crowd: `assets/audio/sfx/goal-crowd.m4a`
- Goal fanfare: `assets/audio/sfx/goal-fanfare.m4a`
- UI tap: `assets/audio/sfx/ui-single-click.m4a`
- Positive result: `assets/audio/sfx/positive.m4a`
- Negative result: `assets/audio/sfx/negative.m4a`
- Stamp/thunk: `assets/audio/sfx/ledger-thunk.wav`
- Awakening bed: `assets/audio/music/awakening-limp.m4a`
- Awakening reveal: `assets/audio/sfx/awakening-angels.m4a`, `assets/audio/sfx/awakening-harps.m4a`

From the existing Remotion project:

- `public/clips/fire-goal.mp4`
- `public/clips/super-speed.mp4`
- `public/clips/contract-negotiation.mp4`
- `public/clips/drill-training.mp4`
- `public/clips/facility-build.mp4`
- `public/audio/title-whoosh.wav`
- Existing composition baseline: `remotion/src/Trailer.tsx`

Any supplied recording cleared only for App Store use needs separate paid-social clearance. Use the Commercial Music Library or owned audio when that clearance is absent.

---

# Video A — “He Caught Fire”

## ASSETS NEEDED FROM YOU — VIDEO A

**Nothing is required from you to build the first draft.** The game already provides the gameplay, Fire Torch animation, Caped Ball icon, font, palette, and sound effects.

### Send these to make the video better

1. **Your voice recording — optional, recommended**  
   Record two separate lines: “My striker caught fire” and “I gave ordinary footballers superpowers.” Use a quiet room. Send WAV or M4A with no music. Leave one second of silence before and after each line. If you do not send this, the video will use captions only.

2. **One personal vertical clip — optional**  
   Record 0.5–1.0 seconds of your hand holding the game on an iPhone, or your face reacting to the goal. Use portrait `1080×1920`, 30 fps, natural light, and no filter. If you do not send this, the video stays fully gameplay-led.

3. **TikTok music choice — needed before publishing**  
   Choose one current track from TikTok's Commercial Music Library. It should be 125–150 BPM, with a clean beat and a small drop near second 3–4. Send the track title and region availability. A temporary guide beat will be used until then.

4. **Live App Store link — needed before running the ad**  
   Send the U.S. App Store URL after release. It will be placed in TikTok Ads Manager, not baked into the video.

### Two quick decisions

- Approve **Dario Flint + Fire Torch** as the featured hero. Dario is the default.
- Confirm the U.S. price is still **$3.99** before publishing. A no-price version will also be exported.

### You do not need to provide

- Gameplay footage.
- Fire, ball, goal, crowd, or interface sound effects.
- The game icon, player art, title art, fonts, or color palette.
- A custom animation or edited video.

## Purpose

This is the primary acquisition video. It should stop a non-fan with an impossible football moment, prove it is real gameplay, show one layer of tactics, and finish with the premium-value message.

Length: **15.0 seconds / 450 frames**  
Primary hook: **“I gave an ordinary striker superpowers.”**  
Payoff: Fire Torch burns through three defenders and scores.  
Tone: astonished developer showing a real result, not a cinematic narrator.

## Required source state

Use real deterministic match footage with:

- Dario Flint as the Fire Torch hero.
- Fire Torch fully charged.
- Three goal-side defenders in range.
- A successful Fire Torch run.
- A goal at the end of the same attack.
- Full formation, playstyle, swap, and energy controls visible at least once.

The existing `public/clips/fire-goal.mp4` already contains the core activation and goal. If a cleaner capture is created, preserve the same truthful game state.

## Beat A0 — impossible first frame

Time: `0.00–0.47` / frames `0–13`

**Picture**

- Cold-open on the peak Fire Torch goal frame, not the beginning of the move.
- Crop 112% around Dario, the goal, and the burning defender trail.
- Show the confetti burst and goal lettering at full color.
- Freeze the best frame for only the final four frames of this beat.

**Title**

- Top-quarter, centered: `MY STRIKER CAUGHT FIRE.`
- Use `ComicStompTitle`.
- “CAUGHT FIRE” uses blue face, gold inner shadow, red outer shadow.
- Let the word `FIRE` flicker between red and flame for two frames. Do not glow or blur it.

**Micro animation**

- Add three 12×12 flame pixels that travel upward in stepped 8 px moves.
- Add a tiny `REAL GAMEPLAY` stamp at x=72, y=172. It appears in one frame with no animation.

**Audio**

- Start with the loudest clean 180 ms of `goal-net-hit.wav`.
- Layer `goal-crowd.m4a` 80 ms later.
- Music begins under the impact, not before it.

**Voice**

Optional creator voice: “My striker caught fire.”

## Beat A1 — rewind the answer

Time: `0.47–1.10` / frames `14–32`

**Picture**

- Run a pixel rewind from goal to the charged Fire Torch state.
- Use seven reverse frames from the real source.
- Hold each frame for two frames.
- On every new frame, offset one 8 px horizontal band left or right by 16 px.
- End on a clean frame with Dario at 100% and the power dock visible.

**Caption**

- Replace the first title with `HERE'S HOW.` in `DeveloperNote` style.
- Place it at y=310. It types in three chunks: `HERE'S` / `HOW` / `.`.

**Audio**

- **[CREATE SFX: `pixel-rewind-630ms.wav`]** A short reversed tape pull mixed with three 8-bit pitch steps.
- Cut the crowd sound to silence on the first rewind frame.
- Add one quiet ball bounce at the end.

## Beat A2 — ordinary player, clear danger

Time: `1.10–2.30` / frames `33–68`

**Picture**

- Show the full portrait match screen at normal scale.
- Dario carries the ball in the final third.
- Add a 2 px cream diamond around Dario. It expands by 8 px, then holds.
- Draw thin red stepped brackets around the three defenders. Do not cover them.

**Labels**

- Above Dario: `DARIO — YOUR STRIKER`.
- Under it, in gold: `POWER READY`.
- Add a small counter at left: `DEFENDERS: 3`.

**Micro animation**

- Dario's label follows at 8-frame intervals, not every frame. This deliberate stepped tracking keeps the pixel feel.
- The gold meter gives one 105% pulse when it reaches 100%.

**Audio**

- Use real kick/pass sound.
- Add a low two-note tension pulse.
- Do not use flame audio yet.

**Voice**

“I gave ordinary footballers superpowers.”

## Beat A3 — power activation

Time: `2.30–3.30` / frames `69–98`

**Picture**

- Hold one clean frame of the gold `FIRE TORCH` power dock.
- The dock rises 14 px with a two-frame overshoot.
- Snap-cut to the first ignition frame.
- Camera zoom goes `100% → 118%` in six frames around Dario.
- Keep Dario within the center 60% of the screen.

**Title**

- `FIRE TORCH` appears behind Dario as huge outline-only letters.
- Use red outline, gold inner line, transparent center.
- The letters remain for 12 frames and split apart as Dario runs through them.

**Audio**

- `fire-torch-ignite.wav` on the exact ignition frame.
- `flame-up.wav` starts 80 ms earlier at low volume to make the hit feel larger.
- Music drops to near silence for 120 ms before ignition, then returns.

## Beat A4 — three-defender payoff

Time: `3.30–6.60` / frames `99–197`

**Picture**

- Play the Fire Torch run at real speed.
- Track Dario with a stepped camera pan. Never rotate the pitch.
- At each defeated defender, freeze for three frames and punch the crop to 125%.
- Return to 112% over four frames.

**Counter stamps**

- First hit: `1 / 3`.
- Second hit: `2 / 3`.
- Third hit: `3 / 3 — CLEAR`.
- Each stamp lands near the defeated defender, then slides to a fixed stack at left.
- Use cream face, red outline, ink shadow.

**Micro FX**

- Emit six rectangular flame fragments at each hit.
- Use only red, gold, gold-light, and flame.
- Each fragment moves on a straight 8 px grid path for 8–12 frames.
- Add one-frame cream impact star. No bloom.
- Reduce background saturation by 15% during each three-frame freeze so the player reads immediately.

**Audio**

- Loop a low layer of `flame-up.wav` or the existing flame loop.
- Use `flame-hit.wav` once per defender.
- Pitch hits up by 0, +2, and +4 semitones.
- Add a quiet crowd “ooh” after defender two.

**Voice**

No voice. Let the action and counter explain the moment.

## Beat A5 — goal and release

Time: `6.60–7.83` / frames `198–234`

**Picture**

- Return to full match framing for the shot.
- On boot contact, insert one cream frame at 35% opacity.
- The ball gets a three-frame flame trail.
- Hold the completed goal and confetti for 18 frames.

**Title**

- `HE BURNED THROUGH ALL THREE.`
- Use `ComicStompTitle`, one line if possible.
- Enter from 125%, settle in 8 frames.
- Add a small handwritten-style sans note below: `...and scored.`

**Audio**

- `shot-scorch.wav` on contact.
- `goal-net-hit.wav`, then `goal-crowd.m4a`.
- Use only the first 700 ms of the goal fanfare.

## Beat A6 — prove the manager game

Time: `7.83–11.17` / frames `235–334`

Use four cuts of 0.7–0.9 seconds. Every cut happens on a tap or panel movement.

1. **Formation** — tap the formation control. Caption: `SET THE SHAPE.`
2. **Playstyle** — change playstyle. Caption: `CHANGE THE PLAN.`
3. **Training** — show a drill result with visible stat gains. Caption: `TRAIN THE HEROES.`
4. **Facilities** — place a building next to a useful neighbor. Caption: `BUILD THE CLUB.`

**Transition**

- Use action match cuts for the first three.
- Use one paper whip into facilities.
- A thin progress rail along the left fills in four gold blocks. This creates forward momentum without a countdown timer.

**Audio**

- Real `ui-single-click.m4a` on every choice.
- `drill-complete-heavy.wav` on the training result.
- `facility-start-work.wav` on the building placement.
- Keep music steady. No voice.

## Beat A7 — conversion end card

Time: `11.17–15.00` / frames `335–449`

**Picture**

- Ink-deep background.
- Caped Ball icon rises from y=1,010 to y=600 over 12 frames with a small cape-like squash.
- A thin pitch line draws behind it from left to right in 10 stepped segments.
- One tiny Fire Torch player runs across the line and exits right.

**Title hierarchy**

1. `HERO FOOTBALL MANAGER` — cream, 70 px, Silkscreen Bold.
2. `$3.99 • ONE PURCHASE` — gold, 52 px.
3. `NO ADS • NO IAP • OFFLINE` — blue-light, 42 px.
4. `TAP TO RUN YOUR CLUB` — cream, 46 px, placed above TikTok's bottom UI.

Place the CTA baseline at `y=1440`. Keep every line within `x=72–900`.

**CTA micro animation**

- The CTA arrow moves 8 px down, returns, waits 14 frames, then repeats.
- Do not imitate TikTok's button.
- The final frame holds for at least 24 frames.

**Audio**

- Short `positive.m4a` cue when the price appears.
- Music resolves on the last downbeat.
- Do not end on an abrupt audio cut; use an 8-frame fade.

**Caption for the post**

`I made a football manager where ordinary players wake up with powers. Dario got fire. 🔥 $3.99, no ads, plays offline.`

---

# Video B — “His Agent Noticed”

## ASSETS NEEDED FROM YOU — VIDEO B

**Nothing is required from you to build the first draft.** The game can create the full contract, awakening, and match story.

### Send these to make the video better

1. **Your voice recording — optional, recommended**  
   Record four separate lines: “He earned seventy-two dollars a week.” “Then he woke up with superpowers.” “His agent noticed.” “Worth it.” Send WAV or M4A with no music. Speak like you are telling a friend a funny story. If you do not send this, the same words appear as captions.

2. **One real-phone negotiation clip — optional**  
   Record 0.7–1.2 seconds of your thumb tapping the wage `+` button on an iPhone. Use portrait `1080×1920`, 30 fps, no glare, and keep the amount readable. If you do not send this, the video uses a deterministic screen capture.

3. **TikTok music choice — needed before publishing**  
   Choose a current track from TikTok's Commercial Music Library. It needs a restrained opening, a lift during the awakening, and a clean beat for the `SIGNED` stamp. Send the track title and region availability. A temporary guide beat will be used until then.

4. **Live App Store link — needed before running the ad**  
   Send the U.S. App Store URL or Apple campaign link after release. It will be added inside TikTok Ads Manager.

### Four quick decisions

- Approve the contract story: **$72/wk → $314/wk**, three years, Starter promise, accepted renewal, then a Fire Torch goal.
- Choose the pitch card: **MONEY TALKS** if the real save owns it; otherwise **STRAIGHT TALK**.
- Approve **Dario Flint + Fire Torch** for campaign continuity. Dario is the default.
- Confirm the U.S. price is still **$3.99** before publishing. A no-price version will also be exported.

### You do not need to provide

- Contract, awakening, or match footage.
- Fire, ball, goal, crowd, negotiation, or interface sound effects.
- The game icon, player art, title art, fonts, or color palette.
- A custom animation or edited video.

## Purpose

This is the deeper conversion video. It turns one player into a tiny story: unknown player, impossible awakening, expensive renewal, manager choice, match payoff. It proves this is a real club-management game rather than a passive match viewer.

Length: **18.0 seconds / 540 frames**  
Primary hook: **“He made $72 a week. Then he became a superhero.”**  
Payoff: the manager signs the hero and the hero changes the next match.  
Tone: funny, intimate, and slightly stressful.

## Required deterministic capture state

Create one controlled career fixture with:

- Dario Flint or another named ordinary player.
- Old weekly wage: `$72 / wk`.
- New agent opening demand: `$314 / wk`.
- Fire Torch awakening.
- Renewal panel with the wage, three-year term, Starter promise, and one pitch card visibly selected.
- A successful negotiated renewal.
- The signed player scoring or creating a Fire Torch goal in the next match.

If the real wage logic produces different values, use the actual values. Never animate numbers that the captured state does not contain.

## Beat B0 — wage shock

Time: `0.00–0.80` / frames `0–23`

**Picture**

- Start on the agent panel with `$314 / WK` centered.
- Crop so the player's face, mood, wage, and plus button are visible.
- On frame 0, the number is already present.
- The agent portrait changes from rest to angry or unhappy on frame 6.

**Title**

- `HE WANTS A 4× RAISE?!`
- Use `ComicStompTitle` at y=320.
- Animate `4×` separately: rotate 3°, scale to 118%, then stamp down.
- Add a tiny red `AGENT ON LINE TWO` label above the portrait.

**Audio**

- `ledger-thunk.wav` on frame 0.
- `negative.m4a` at low volume on the portrait change.
- Add a 250 ms phone-line click.

**Voice**

“He earned seventy-two dollars a week.”

## Beat B1 — yesterday versus today

Time: `0.80–1.70` / frames `24–50`

**Picture**

- Split the canvas with a hard ink seam.
- Left: renewal queue or player contract showing `$72 / WK`, labeled `YESTERDAY`.
- Right: agent panel showing `$314 / WK`, labeled `TODAY`.
- A red pixel line crosses out `$72` from left to right.
- `$314` counts upward in four hard steps: 72 → 150 → 240 → 314.

**Caption**

- Bottom-safe center: `THEN HE WOKE UP.`
- Gold type. No shadow until the word `UP`, when a gold shadow snaps on.

**Audio**

- Four quiet stat-step taps for the number changes.
- Music low-pass filter closes slightly as the count rises.

## Beat B2 — the awakening

Time: `1.70–4.63` / frames `51–138`

Use the production `AwakeningCutsceneScreen` with Fire Torch. Compress its three beats without changing their order.

**B2.1 Hush — 0.70 s**

- Player limps two steps and falls.
- Teammates rush in.
- Camera makes the existing 4 pt opening jolt.
- Caption: `SOMETHING IS WRONG.`
- Audio: first 0.7 seconds of the awakening limp bed.

**B2.2 Omen — 0.73 s**

- Red light pulses under the shirt.
- Warm palette creeps into the surrounding players one 8 px band at a time.
- Caption: `THE SHIRT IS GETTING HOT.`
- Add one heartbeat at the end.

**B2.3 Ascension — 1.50 s**

- Use the production white flash.
- Player rises 70 pt while teammates burst outward.
- Fire crown appears.
- Display `NEW HERO` and `FIRE TORCH` as two staggered title impacts.
- `NEW HERO` lands first in cream and gold.
- `FIRE TORCH` lands six frames later in red, gold, and ink.
- Audio: `awakening-angels.m4a`; start `awakening-harps.m4a` 1.17 seconds later if the beat remains long enough. Layer `fire-torch-ignite.wav` at 60% on the title impact.

**Voice**

“Then he woke up with superpowers.”

## Beat B3 — the agent noticed

Time: `4.63–5.50` / frames `139–164`

**Transition**

- Pixel rewind the last ascension frame for only four frames.
- Match-cut the gold awakening label to the gold wage number.

**Picture**

- Return to the agent panel.
- Add a small developer note above it: `HIS AGENT NOTICED.`
- The angry mood face gives one two-frame horizontal shake.

**Audio**

- Phone reconnect click.
- One dry comedic silence of 120 ms.

**Voice**

“His agent noticed.”

## Beat B4 — build the offer

Time: `5.50–9.20` / frames `165–275`

Show the actual decision surface. Do not montage so quickly that choices cannot be read.

**Choice 1 — wage**

- Tap plus until the chosen offer is shown.
- Magnify only the wage row by 110% for 12 frames.
- Caption: `MONEY`.

**Choice 2 — term**

- Select `3Y`.
- The chosen card drops 2 px and shows its blue lip.
- Caption: `SECURITY`.

**Choice 3 — promise**

- Select `STARTER — A • HUGE`.
- Add a red micro-caption: `THIS PROMISE HAS A COST.`
- Briefly show its full consequence text.

**Choice 4 — pitch card**

- Select one real available card.
- Use `MONEY TALKS` only if that card exists in the deterministic fixture.
- Caption: `LEVERAGE`.

**Progress display**

- Four small labels stack at left: MONEY / SECURITY / PROMISE / LEVERAGE.
- Each turns from grey to blue when selected.
- This is not a fake game UI. It is an editorial overlay outside the captured phone frame.

**Audio**

- `ui-single-click.m4a` for each selection.
- Raise pitch by one semitone per choice.
- Keep music tension low and rhythmic.

## Beat B5 — send and wait

Time: `9.20–10.40` / frames `276–311`

**Picture**

- Tap the real offer button.
- Crop to the agent portrait and outcome area.
- Add a three-dot typing indicator made from square 8×8 pixels.
- Dot timing: 1–2–3, blank, repeat once.
- Hold the second repeat for six frames longer than expected.

**Title**

- `PLEASE SAY YES.` in `DeveloperNote` style.
- It enters one word per agent-dot pulse.

**Audio**

- Remove the beat from the music, leaving only the bass note.
- Three muted button ticks.
- No voice.

## Beat B6 — signed

Time: `10.40–11.47` / frames `312–343`

**Picture**

- Show the real accepted outcome.
- A `SIGNED` stamp hits diagonally at `-6°`.
- Stamp uses red outline, cream face, ink shadow.
- The player's portrait swaps to joy.
- A thin gold line connects the player portrait to the Fire Torch icon.

**Micro animation**

- Stamp lands at 112%, compresses to 92%, returns to 100%.
- Emit four paper flecks, not confetti.

**Audio**

- `ledger-thunk.wav` and `positive.m4a` together.
- Restore the full music beat after the impact.

**Voice**

“Worth it.”

## Beat B7 — the plan plays out

Time: `11.47–14.53` / frames `344–435`

**Picture**

- Match-cut from the signed Fire Torch icon to Dario's charged Fire Torch meter.
- Show 0.6 seconds of ignition.
- Show 1.4 seconds of the defender run.
- Show 1.0 second of the shot and goal.
- Use no title over the first 1.5 seconds. Let the payoff read.

**Caption**

- After the second defender falls: `THE PLAN PLAYED OUT.`
- Cream type, gold shadow, no red.

**Audio**

- Fire ignition, one defender hit, shot scorch, goal impact.
- Do not repeat the three-counter treatment from Video A. This video needs a different identity.

## Beat B8 — whole-club montage

Time: `14.53–16.20` / frames `436–485`

Three 0.55-second action cuts:

1. Drill result: `TRAIN THEM.`
2. Facility placement: `BUILD FOR THEM.`
3. Hero Cup bracket: `CLIMB WITH THEM.`

Each title is one word group in the same screen position. The background changes under it on the downbeat.

**Transition**

- Ink snap between scenes.
- Keep the action location aligned near the center to prevent visual whiplash.

**Audio**

- Drill complete hit.
- Facility construction cue.
- One short crowd lift on the cup.

## Beat B9 — conversion end card

Time: `16.20–18.00` / frames `486–539`

**Picture**

- Ink-deep background with a small cream paper strip behind the product name.
- Caped Ball icon is centered at x=540, y=520.
- Product name is centered at y=720, split across two lines, with a maximum width of 820 px.
- A tiny Dario sprite with flame crown stands on the final letter.

**Copy**

1. `HERO FOOTBALL MANAGER`
2. `$3.99 • ONE PURCHASE`
3. `NO ADS • NO IAP • OFFLINE`
4. `TAP TO RUN YOUR CLUB`

Place the CTA baseline at `y=1440`. Keep every line within `x=72–900`.

**Micro animation**

- The flame crown loops on a three-frame cycle.
- The price receives one gold underline drawn left-to-right.
- The CTA gives one 104% pulse, then remains still.

**Audio**

- Small positive chime.
- End the music on a full beat.
- Final 120 ms fade.

**Caption for the post**

`He was cheap until he became a superhero. Then the agent called. 😭 Hero Football Manager is $3.99, with no ads or IAP.`

---

# Video C — “From Stand-Up to Superpowers”

## ASSETS NEEDED FROM YOU — VIDEO C

**This personal version needs four items from you.** They are the only new assets required. The game already provides all gameplay, animations, fonts, icons, and game sound effects.

### Send these four items

1. **Stand-up comedy photo or video — required**  
   Send one strong stage photo or a 1–3 second video. You should be visible with a microphone. Use the highest-resolution original. Confirm that you can use the image in paid advertising. A real, imperfect club recording is better than a polished stock image.

2. **Personal Vietnam photo or video — required**  
   Send one photo or a 1–3 second clip from your life after moving to Vietnam. Use an ordinary, specific moment: arriving with luggage, working in a café, walking your neighborhood, or sitting at your desk. Avoid a generic tourist image. Confirm that every visible person permits paid-ad use.

3. **Making-the-game material — required**  
   Send two or three items from the two-year build: an early screenshot, notebook page, old UI, development photo, short screen recording, or dated progress image. The best set shows one rough early build and one later build. Do not create fake old material.

4. **Your final voice-over — required**  
   Record: “So I retired from stand-up comedy, moved to Vietnam, and learned how to make a football game. Two years later… here it is.” Send one clean WAV or M4A file with no music. Record in a quiet room. Leave one second of silence at the start and end. Speak as if you are telling one person the story.

### Optional upgrades

5. **A present-day creator clip**  
   Record 0.5–1.0 seconds of yourself holding the game or looking at it on your phone. Use portrait `1080×1920`, 30 fps, natural light, and no beauty filter.

6. **TikTok music choice**  
   Choose a warm, commercially cleared track from TikTok's Commercial Music Library. It needs a quiet opening, a lift on “Two years later,” and a clean beat when Fire Torch activates.

7. **Live App Store link**  
   Send the U.S. App Store URL before running the ad. It will be added in TikTok Ads Manager, not baked into the video.

### Four quick decisions

- Confirm that “retired from stand-up comedy,” “moved to Vietnam,” and “two years later” are accurate.
- Confirm whether your face and full name can appear in the paid version.
- Approve **Dario Flint + Fire Torch** as the gameplay payoff.
- Confirm the U.S. price is still **$3.99** before publishing.

### You do not need to provide

- Edited footage or a finished personal montage.
- Match, training, facility, or contract footage.
- Ball, goal, crowd, fire, interface, or transition sound effects.
- The game icon, player art, title art, fonts, or color palette.

## Purpose

This is the trust and connection video. It gives the game a real person, a surprising life change, and a two-year effort before showing the Fire Torch payoff from Video A. It should feel like a developer telling the truth, not a brand biography.

Length: **22.0 seconds / 660 frames**  
Primary hook: **“I retired from stand-up comedy.”**  
Payoff: the microphone cable becomes a pitch line, then Fire Torch takes over the match.  
Tone: personal, dry, warm, and proud without sounding self-important.

## Voice-over script and timing

Use one continuous natural recording:

> “So I retired from stand-up comedy, moved to Vietnam, and learned how to make a football game. Two years later… here it is.”

Target delivery: **8.0–9.0 seconds**. Do not speed up the recording. Build the picture edit around the natural pauses.

## Visual thesis

The microphone cable is the connecting line through the opening. It begins on the comedy stage, travels across the Vietnam and development images, and becomes the white touchline of the football pitch. This is one simple programmatic animation, not a different effect for every photo.

Keep personal images visibly real. Do not remove all grain, stabilize every movement, replace backgrounds, or use AI-generated stand-ins.

## Beat C0 — the strange first sentence

Time: `0.00–1.00` / frames `0–29`

**Picture**

- Start on the strongest real stand-up image. Your face and microphone must be readable on frame 0.
- Crop vertically around you. Preserve some stage darkness and audience context.
- Add a small cream label at top-left: `REAL STORY`.

**Title**

- `I RETIRED FROM STAND-UP.`
- Use cream text with an ink outline and one red offset shadow.
- Do not use the full `ComicStompTitle` entrance. The words appear in two hard cuts: `I RETIRED` then `FROM STAND-UP.`
- Keep the title in the top quarter without covering your face.
- Add a smaller fixed line near y=1450: `...TO BUILD THIS FOOTBALL GAME.` This must be readable on frame 0.

**Audio**

- Voice starts on frame 0: “So I retired from stand-up comedy…”
- Keep 250 ms of real room or stage sound under the first word if the source recording is cleared.
- Music enters quietly after “retired.”

## Beat C1 — leave the stage

Time: `1.00–2.90` / frames `30–86`

**Picture**

- Show a second stand-up image or continue the real clip.
- A 4 px cream microphone cable traces from the microphone toward the lower edge.
- On “moved,” the cable pulls the image left like a physical wipe.
- Reveal the Vietnam image behind it. Do not use an airplane animation or stock skyline.

**Caption**

- `THEN I MOVED TO VIETNAM.`
- Use `DeveloperNote` style at y=330.
- `VIETNAM` lands in gold six frames after the rest of the sentence.

**Audio**

- One dry microphone-switch click at the wipe.
- A short room-tone change sells the location cut. Do not add cliché travel music.

## Beat C2 — a new life, not a postcard

Time: `2.90–4.80` / frames `87–143`

**Picture**

- Hold the personal Vietnam image long enough to recognize it.
- If using video, keep its natural handheld movement.
- Add a tiny location tag: `VIETNAM` and the real year. Use no fake date.
- The microphone cable continues across the lower third as one steady line.

**Micro animation**

- Place three small pixel marks along the cable on spoken syllables.
- Each mark appears once and stays. Do not make them bounce.

**Voice**

- “…moved to Vietnam…”

## Beat C3 — learning by building

Time: `4.80–7.20` / frames `144–215`

**Picture**

- Show three real development items for about 0.8 seconds each.
- Cut 1: early game screenshot or notebook page.
- Cut 2: code, desk, or test build.
- Cut 3: later playable build.
- Place each inside a slightly rotated cream photo border with a real date or year.
- The cable crosses behind each image and straightens after every cut.

**Title**

- `LEARNED BY MAKING IT.`
- Type one word per cut: `LEARNED` / `BY MAKING` / `IT.`
- Use blue face, ink outline, and no red shadow.

**Audio**

- Use a soft key tap, UI click, and ball kick on the three cuts.
- Keep each effect below the voice.

**Voice**

- “…and learned how to make a football game.”

## Beat C4 — two years later

Time: `7.20–8.80` / frames `216–263`

**Picture**

- Show the rough early build on the left and the current game on the right.
- A hard vertical seam moves left, replacing old with current.
- Use only real screenshots from the two dates.
- As the current game fills the frame, the microphone cable snaps into a straight white pitch touchline.

**Title**

- `TWO YEARS LATER…`
- Use `ComicStompTitle`, but enter at 105% instead of 160% so it feels reflective.
- Hold the ellipsis for eight frames, then remove the title on “here it is.”

**Audio**

- Music drops to one sustained note under the ellipsis.
- Add `title-whoosh.wav` quietly as the seam moves.

**Voice**

- “Two years later…”

## Beat C5 — here it is

Time: `8.80–10.20` / frames `264–305`

**Picture**

- The touchline expands into the full current match screen.
- Show the score, both teams, moving players, and the full control row.
- Add the Caped Ball icon for only 12 frames, then clear it so gameplay owns the screen.

**Title**

- `HERO FOOTBALL MANAGER`
- Center it in the top quarter with cream face, blue shadow, red second shadow, and no box.

**Audio**

- Voice finishes: “…here it is.”
- Let one clean crowd lift answer the final word.
- Music reaches its first full beat.

## Beat C6 — the impossible result

Time: `10.20–15.30` / frames `306–458`

Reuse the strongest part of Video A instead of inventing a third gameplay language.

**Picture**

- Start with Dario carrying the ball and Fire Torch fully charged.
- Show the `FIRE TORCH` activation.
- Show two defender impacts, then the shot and goal.
- Use real-speed gameplay. Keep the full third hit only if the action still reads within 5.1 seconds.

**Title**

- First 0.8 seconds: `ORDINARY PLAYERS.`
- On ignition, replace it with `SUPERPOWERS.`
- The second word uses the full cream, gold, red, and ink title stack.

**Audio**

- Fire ignition, defender hits, shot scorch, goal-net impact, then crowd.
- No voice. Let the game provide the proof.

## Beat C7 — it is a manager game

Time: `15.30–18.70` / frames `459–560`

Use four quick actions:

1. Change playstyle: `COACH THE MATCH.`
2. Complete a drill: `TRAIN THE TEAM.`
3. Place a facility: `BUILD THE CLUB.`
4. Show the filled Hero Cup bracket: `CHASE THE CUP.`

**Transition**

- Cut on real taps and panel motion.
- The microphone cable/touchline stays as a thin progress rail at the bottom and fills gold after each action.

**Audio**

- One real interface or result sound per cut.
- Music stays warm and forward. Do not restart the track after the goal.

## Beat C8 — personal conversion card

Time: `18.70–22.00` / frames `561–659`

**Picture**

- Use ink-deep background.
- Place a small circular crop of the present-day creator clip at x=190, y=560 if supplied.
- Place the Caped Ball icon at x=540, y=520 if no creator clip is supplied.
- A tiny Dario Fire Torch sprite runs from the creator image to the product name.

**Copy**

1. `I MADE THIS.`
2. `HERO FOOTBALL MANAGER`
3. `$3.99 • ONE PURCHASE`
4. `NO ADS • NO IAP • OFFLINE`
5. `TAP TO RUN YOUR CLUB`

Keep every line within `x=72–900`. Place the CTA baseline at `y=1440`.

**Micro animation**

- `I MADE THIS.` types on like a developer note.
- The product name lands once. Do not bounce it repeatedly.
- The CTA receives one gold underline, then the final frame holds for at least 24 frames.

**Audio**

- Use a restrained positive chime.
- End on a complete beat with a 120 ms fade.

**Caption for the post**

`I retired from stand-up, moved to Vietnam, and spent two years learning how to make a football game. Here it is. Hero Football Manager — $3.99, no ads, no IAP, plays offline.`

---

# Implementation notes for an LLM

## Reuse the existing Remotion project

Add three new compositions beside the existing trailer:

- `TikTokFireTorch15`
- `TikTokHeroWage18`
- `TikTokFounderStory22`

Do not rewrite the current App Store trailer composition. Reuse its font registration, colors, `staticFile` pattern, `Audio`, `Video`, `Sequence`, `spring`, and `interpolate` setup.

Recommended component list:

- `TikTokSafeFrame`
- `ComicStompTitle`
- `DeveloperNote`
- `PixelRewind`
- `CounterStamp`
- `ChoiceProgress`
- `PremiumEndCard`
- `MicCableTimeline`

Do not build a general motion-design framework. These components only need the props used by the three videos.

## Capture truth before decorating it

1. Create deterministic dev-harness routes for any missing source scene.
2. Capture each scene without marketing overlays.
3. Save the route, seed, viewport, state fixture, and clip time range in a provenance JSON file.
4. Verify every displayed wage, promise, score, player, and outcome against the captured state.
5. Add editorial titles and transitions only after raw clips are approved.

## Export set

For each video, create:

- SFX + voice master without music.
- Guide-music review version.
- Final TikTok version with commercially cleared music.
- Clean version without platform watermark for Reels and Shorts.
- One poster frame at the strongest readable hook.
- One JSON timing manifest listing every beat, title, clip range, and audio cue.

## Acceptance checklist

- [ ] The first frame explains the hook without sound.
- [ ] Videos A and B show real gameplay or game UI within the first 0.5 seconds.
- [ ] Video C explains “stand-up to football game” on frame 0 and reveals full gameplay by 10.2 seconds.
- [ ] No title blocks the ball, hero, contract amount, or decision control.
- [ ] Every essential title remains in the safe area.
- [ ] No static image occupies more than half of the ad.
- [ ] Captions remain readable at 50% phone preview size.
- [ ] Pixel art uses nearest-neighbor sampling.
- [ ] Price is exactly `$3.99` for the U.S. version.
- [ ] “No ads,” “No IAP,” and “Offline” match the shipped game.
- [ ] Every result is produced by the real deterministic game state.
- [ ] Music and every external sound are cleared for paid commercial use.
- [ ] Final audio is clear, with no clipped peak.
- [ ] The TikTok preview confirms the CTA and titles are unobstructed.
- [ ] All three videos export as 1080×1920 H.264 with Rec.709 tags.

## Grok Audit changes incorporated

Grok 4.6 reviewed Videos A and B at high reasoning. Its useful top-level findings were checked against the document before editing. The detailed finding body returned a placeholder, and one retry stalled, so no unverified claim was copied into this spec. Video C was added after that audit.

- Standardized both videos on one conversion action: `TAP TO RUN YOUR CLUB`.
- Removed the contract beat from Video A. Video A now owns spectacle, tactics, training, and facilities. Video B owns the contract story.
- Changed `DARIO — ORDINARY STRIKER` to `DARIO — YOUR STRIKER` because he is already awakened in that scene.
- Moved Video B's icon and product name away from the right-side TikTok controls.
- Added exact end-card CTA coordinates to keep both calls to action above TikTok's bottom interface.

## Current TikTok guidance used

- Vertical 9:16 is recommended for in-feed ads.
- Dynamic motion and clear audio are required for ads.
- A game-related hook should lead immediately into gameplay.
- Simulation and strategy creative should use hook → gameplay → CTA.
- TikTok's 2026 trend guidance favors honest, behind-the-scenes storytelling over overly polished brand distance.
- Music for paid promotion should come from the Commercial Music Library or have separate commercial clearance.

Official references:

- [TikTok 2026 trend forecast](https://ads.tiktok.com/business/en-US/next)
- [TikTok in-feed ad specifications](https://ads.tiktok.com/help/article/tiktok-auction-in-feed-ads)
- [TikTok ad format rules](https://ads.tiktok.com/help/article/tiktok-ads-policy-ad-format-and-functionality)
- [TikTok simulation-game creative guidance](https://ads.tiktok.com/business/creativecenter/quicktok/online/creative-tips-for-simulation-games/pc/en)
- [TikTok strategy-game creative guidance](https://ads.tiktok.com/business/creativecenter/quicktok/online/creative-tips-for-strategic-games/pc/en)
- [TikTok Commercial Music Library](https://ads.tiktok.com/help/article/how-to-use-the-commercial-music-library)
