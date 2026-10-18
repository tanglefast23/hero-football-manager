# Grok team sheet review

Reviewer: 8a7119e9-aa5a-4098-be71-e3809ad0e329. Read-only review.

Showing 1 of 903 activities (limited to 1)

Confirmed. The 3-4-3 team sheet paints engine-slot order from left to right. The forward and midfield rows are on the wrong sides. The vertical rows are right.

Nothing reorders the cards between the sheet and the match. The view model keeps `lineup.playerIds` in order. The team builder copies that order into engine slots 0–10. `formationTarget` then places each slot from `FORMATION_ENGINE_ANCHORS`. For this shape those anchors are deliberately not left to right. The back line stays put when the formation changes, and a test locks that.

Team 0 restart positions, in centimetres from the left touchline:

- Slot 8, Ace, is at 5644. That is the right channel.
- Slot 9, Kai, is at 1224. That is the left channel.
- Slot 10, Dario, is at 3264. That is the centre.

The sheet shows Ace, Kai, Dario from left to right. The engine plays Kai, Dario, Ace. The middle card is the left channel. The right-hand card is the central finisher. The midfield row is the same class of miss: right, left, inside-left, inside-right. The back three match the engine. The little formation diagram draws unnamed dots by their x coordinate, so it can look symmetrical while the named cards do not.

Swap the left forward card with the right forward card. That puts Ace in slot 10. Swapping him with the middle card puts him in the left channel. After the swap, the sheet will show Ace on the right. That right-hand card is the centre until the display is fixed. A matchday-phase swap is allowed, and the teams are built from the lineup when the fixture starts.

The later fix is to sort each role row by anchor x before drawing it. Leave the stored lineup order and the anchors alone. Test the display order for the 3-4-3 forwards (slots 9, 10, 8) and midfield (slots 5, 6, 7, 4). Do not sim a fixture.
