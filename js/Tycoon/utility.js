let rememberTimerSkipTurn = null;

function setTimerSkipTurn(game, clearTimer = true) {
    if (clearTimer && rememberTimerSkipTurn !== null) {
        clearTimeout(rememberTimerSkipTurn);
    }

    rememberTimerSkipTurn = setTimeout(() => {
        let skipPlayer = game.spillere[game.sinTur]; // Remembers the player who's turn it is.
        Layout.TegneHoppover(
            [
                "Force best move for player",
                "Skip the players turn",
                "Make the player pass their turn",
                "Terminate the player from the game"
            ],
            [
                () => player_com(game, skipPlayer, true),
                () => game.NesteSinTur(),
                () => game.SpillerPass(skipPlayer),
                () => game.AvsluttSpiller(skipPlayer)
            ]
        );
    }, 20000); // Comes up if the player hasn't done anything in 20 seconds.
}