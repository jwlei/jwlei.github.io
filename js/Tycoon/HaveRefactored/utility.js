let rememberTimerSkipTurn = null;

function setTimerSkipTurn(game, clearTimer = true) {
    if (clearTimer && rememberTimerSkipTurn !== null) {
        clearTimeout(rememberTimerSkipTurn);
    }

    rememberTimerSkipTurn = setTimeout(() => {
        let skipPlayer = game.players[game.hasTurn]; // Remembers the player who's turn it is.
        Layout.drawSkip(
            [
                "Force best move for player",
                "Skip the players turn",
                "Make the player pass their turn",
                "Terminate the player from the game"
            ],
            [
                () => player_com(game, skipPlayer, true),
                () => game.nextPlayersTurn(),
                () => game.playerPass(skipPlayer),
                () => game.terminatePlayer(skipPlayer)
            ]
        );
    }, 20000); // Comes up if the player hasn't done anything in 20 seconds.
}