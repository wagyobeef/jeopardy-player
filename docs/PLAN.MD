We will implement the game board as defined in GAME-BOARD.MD

## Progress

Implemented through the end of Double Jeopardy. Final Jeopardy is still in progress in GAME-BOARD.MD, so the game stops after that round's summary.

- The board shows categories and point values. Question text stays hidden until a clue is chosen.
- Only the current selector can choose. Selection follows the rules in GAME-BOARD.MD.
- Every player answers or skips. The category is shown above the question. "Answer is..." shows for one second, then the answer and that player's own submitted answer. Players report correctness, unless they skipped.
- Scores update by the clue value, or by the Daily Double wager. A wrong or skipped Daily Double loses the wager.
- Played clues are blank. The end of a round shows rank, score, and how many questions each player got right.
- The player with the lowest score chooses first in Double Jeopardy.
- Leaving from the door icon clears the active game on this browser and removes that player from the live session. Their score stays with the invitation code, so joining it again restores them.