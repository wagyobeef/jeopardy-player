# Game Board

## Purpose

This will be the main interface on which the Jeopardy game is played. The gameplay loop will loosely follow that of the Jeopardy game show but with tweaks to accommodate the casual, online format.

## Gameplay

The game board will look identical to that of the Jeopardy game show. Categories will be shown as the column titles of the game board. Questions on the board will show their point value, but the question's text will not be shown until it is selected.

At the bottom of the screen, players and their scores will be displayed.

### Question Selection

Each turn, a question is selected by one of the players. The player who selects the next question is defined by the following rules:

- At the start of Double Jeopardy, the player with the lowest score selects the next question; if multiple players are tied for the lowest score, one is selected at random
- At the game start, one player is selected at random to choose the next question
- If a player selected the current question and got it correct, they will continue to choose the next question
- If the player who selected the current question gets it incorrect or doesn't answer, the next question selector is randomly chosen out of the players who got the current question correct
- If none of the players on a turn get the question correct, then question selection continues with the player who last selected a question

### Answering a Question

Once a question is selected, the question text will be shown on the next screen. Above the question text will be the category of the question. Below it will be an input that allows a player to input and submit their answer. They will also have the option to skip and not provide an answer.

Unlike the Jeopardy game show, each player will have the opportunity to input an answer for any question. If a player has yet to answer or skip the question, text underneath their score will read "Waiting for player...". If they have taken their action, the status will read "Submitted".

Once all players have submitted an answer, "Answer is..." will appear on screen for one second before showing the answer. 

After the answer is shown, the answer that each player inputted will be displayed in a bubble above their place on the bottom bar. Each player will then be prompted to report whether they got the question correct. If they skipped the question, they will get no such prompt. "Waiting for player..." will show under a player's score if they have yet to report their answer correctness. Once the answer is shown, there will be a selector at the top of the screen for the player to look at the question or answer in case they want to review. The answer that the player submitted will be under the actual answer (i.e. "Your answer: ")

After answer correctness is reported, each player who got the question correct will have their scores incremented by the value of the question. If they are receiving points the text next to their score will show how many points they received (e.g. +200). 

After scores are updated, a "Continue" button will be shown on screen to go to the next turn. If a player has yet to press the button, "Waiting for player..." will appear below their score. Once all players have pressed the continue button, we return to the game board to select the next question. The question that was last played is now blank and can not be selected during future turns.

### Daily Double
The gameplay flow will be slightly different for Daily Double questions, as players will have a chance to input the number of points they want to bet. When a Daily Double question is selected, we are taken to a screen that says Daily Double. Beneath the title, players will be prompted to input the number of points they want to bet. This number MUST be between 0 and double the point value of the question (e.g. if the question is worth 200, they can bet up to 400 points). If a player is yet to submit their wager, "Waiting for player..." will appear beneath their score. 

After bets have been submitted, we will be taken to the question text. The bet amount of each player will be shown beneath their score. Players will then submit their answers as with any other question and report their correctness as with any other question. However, the main difference is that, if the player is correct, they will receive as many points as they bet, not the value of the question. If they get the question wrong or skip answering, they will lose the amount of points that they bet, unlike with other questions. The amount of points received or lost will be shown next to each player's score.

### End of Round
At the end of each round (i.e. Jeopardy or Double Jeopardy), there will be a summary screen, showing the rank of each player and their score. It will also show how many questions each player got correct. Every player must press a "Continue" button to go to the next round. If a player has not yet pressed the Continue button, "Waiting for player..." will appear below their score.

### Final Jeopardy
WORK IN PROGRESS

## Other Interface Notes

### Leaving a Game
On the top right of the screen, there will be a door icon that can be used to exit from the current game. This will reset the user's local storage, so they can enter a new game. This will also remove the player from the game session, so the other players can continue on with the game.

Leaving a game will not remove their game data. As a result, they can always return with the same invitation code and continue the game with their previous score.