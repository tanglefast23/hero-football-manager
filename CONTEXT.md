# Hero Football Manager

Kairosoft-style soccer club management sim with superpowered players. This
glossary fixes the words the codebase argues about. It is a glossary only —
design decisions live in `docs/01`–`docs/11`, and architecture decisions in
`docs/adr/`.

## Language

### Shots

**Shot power**:
How hard the ball was struck, on the 1–999 rating scale. A projection for
display and Resolve damage only; it never feeds the save roll.
_Avoid_: shot strength, shot quality

**Shot danger**:
The chance a shot beats the keeper it is actually facing, 0..1. Keeper-relative,
so it holds its meaning at every stat scale. Distinct from **shot power**: a
tap-in is high danger and low power, a 30-yard blast is the reverse.
_Avoid_: shot quality, xG, threat, goal chance

**Shot tier**:
The three-step visual grade a shot is drawn at, derived from its **shot
danger**. Ordinary is the floor; nothing renders below it.
_Avoid_: shot level, shot grade, shot rank

### Heroes

**Heat**:
The charge a fielded hero builds from involvement. At the threshold it banks
until the power's useful context appears.
_Avoid_: gauge, meter, charge

**The Zone**:
The state a hero holds after Heat is banked and before their power fires. It
does not expire.
_Avoid_: charged, ready, armed

**Useful context**:
The authored situation in which firing a given power actually matters. A power
that needs a victim never fires targetless.
_Avoid_: trigger, condition

### Goalkeeping

**Resolve**:
A keeper's per-team meter, base 100, that scales how strongly saves resist
shots. Power shots and pressure damage it instead of scoring outright.
_Avoid_: keeper power, stamina, confidence
