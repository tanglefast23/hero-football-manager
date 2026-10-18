# Opus: AI Cup scoring

Source reviewed: pinned 28386452. Data: actual season-5-end.json. Read-only, no simulations, browser actions, or edits.

All 44 non-user S5 Cup ties are 1-0 or 0-1 (22 each). This is the intended abstraction in m2-career.ts deterministicCupRoundResults. The winner uses current club strength times a seeded performance roll with upset tails. The fixed score records the winner.

Only the user's Cup tie is replaced with the real played result, including its penalty winner. Our five S5 scores are real engine results, not the AI Cup formula.

Non-user league fixtures run resolveMatchday -> quickResultForFixture -> quickMatchForFixture through real engine ticks. The actual S5 export includes 0-7, 5-4 and 4-4 rival league results. balance.ts scoreFixture is not that production path.

Cup results do not affect league standings, goal difference, or division award boards. Those read league fixtures/stat lines. Abstract rival Cup ties do not create player goal or save stats. User Cup player stats are real and can enter the user's season recap/celebration.

The bracket still renders the fixed scores. Showing only the winner for abstract rival ties is a presentation/product option, not a confirmed outcome bug or a measured balance defect. No patch applied.
