# Game Creation

## Purpose
Players can create new Jeopardy game sessions by supplying the j-archive.com game they want to play, or join existing ones through invitation codes. These invitation codes also serve as the game IDs.

When users first enter the site, it will load an existing game session if the user was previously in a game, and the game is still in progress. Otherwise, users will see an option to create a new game session or join an existing one.

---

## Game Creation
When a user creates a new game session, it will ask for the URL of the j-archive.com game that the user wants to play. 

If the URL is valid, a new game session is created; the URL will be scraped to store the questions and answers data for the game.

## Data

A game is one archived episode.

- **id**: archive `game_id`
- **title**: show number and air date, e.g. Show #890, June 17, 1988
- **boards**: Jeopardy and Double Jeopardy; Final Jeopardy will be a special last round at the end

### Board

Jeopardy and Double Jeopardy are the same shape.
- **name**: Jeopardy or Double Jeopardy
- **categories**: six names, left to right
- **clues**: up to 30, arranged as 6 columns by 5 rows

A column lines up with one category. Rows run top to bottom, from the smallest dollar value to the largest. Dollar values are properties of that game's board.

Some squares were never played. Those are empty cells, not clues.

### Clue
- **column**: 1–6
- **row**: 1–5
- **category**: the category name for that column
- **value**: the face value of that square
- **question**: the clue text
- **answer**: the correct response only
- **dailyDouble**: true or false

`dailyDouble` comes from the square being marked as a Daily Double. The dollar amount shown next to `DD:` is the contestant's wager on that episode, not the square's face value. Users will be able to wager an amount on a Daily Double question.

The answer is the text marked as the correct response. The same cell also contains the transcript of who answered and whether they were right. That transcript is separate from the answer.

### Final Jeopardy
Final Jeopardy is one category, one question, and one answer. It has no grid and no Daily Double.

---

## Joining a Game
A user can join a game by inputting a game invitation code. If they were already part of the game in progress, then they will resume as the same player with the same score.

When a player creates or joins a game, they will be given a player_id associated with the game session. The player_id is stored locally, so they will be able to resume the game, even if the page is refreshed or they have to step away.

---

## Staying Connected
Both game creators and game joiners will stay connected to a game session through Web Sockets.