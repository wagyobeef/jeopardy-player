We will implement the game board as defined in GAME-BOARD.MD

## Progress

Implemented through Final Jeopardy and the screen for starting another game in the same room.

- Players enter a name when they create or join. That name is shown for them in the game.
- The board shows categories and point values. Question text stays hidden until a clue is chosen.
- Only the current selector can choose. Selection follows the rules in GAME-BOARD.MD. On their turn, the highlight starts on the top remaining question in the last column, or the top-left question if that column is empty. Arrow keys move from there and Enter selects it. Text inputs are focused when they appear. Enter submits an answer, a bet, or Continue.
- Every player answers or skips. The category is shown above the question. "Answer is..." shows for one second, then the answer and that player's own submitted answer. Each submitted answer appears in a bubble above that player after the answer is shown. Players report correctness, unless they skipped.
- Scores update by the clue value, or by the Daily Double wager. A wrong or skipped Daily Double loses the wager.
- Played clues are blank. The end of a round shows rank, score, and how many questions each player got right.
- The player with the lowest score chooses first in Double Jeopardy.
- Later round summaries show questions correct this round and the cumulative total.
- Final Jeopardy shows its category first. Each player bets from 0 to 5000, then answers. A correct answer wins the bet. A wrong or skipped answer loses it.
- After the Final Jeopardy summary, anyone still in the room can enter the next J-Archive URL. That starts a new game for those players with the same invitation code and scores reset to zero. Anyone can leave before that happens.
- Leaving from the door icon clears the active game on this browser and removes that player from the live session. Their score stays with the invitation code, so joining it again restores them.