function checkPlayer_comIsPlaying() {
    if (rememberGame.status == "G") {
        rememberGame.spillere.filter(s => (s.spillerKey == "PC")).forEach(spiller => {
            player_com(rememberGame, spiller);
        });
    } else if (rememberGame.status == "S"
        && rememberGame.sinTur >= 0
        && rememberGame.spillere[rememberGame.sinTur].spillerKey == "PC") {
        player_com(rememberGame, rememberGame.spillere[rememberGame.sinTur]);
    }
    if (rememberGame.status != "F") { setTimeout(checkPlayer_comIsPlaying, 1500); }
}

function player_com(game, player, heleRunden = false) {
    if (game.status == "G") {
        game.spillBunke.filter(b => (b.modus == "Kan se" && game.spillere[b.til] == player)).forEach(bytte => {
            game.BytteKort_FaaKort(bytte);
        });
        game.spillBunke.filter(b => (b.modus == "Velg" && game.spillere[b.fra] == player)).forEach(bytte => {
            //Finner de dårligste kortene
            for (var i = 1; i <= bytte.antall; i++) {
                bytte.kort.push(player.kort[i - 1]);
            }
            //Og gir dem.
            game.BytteKort_GiKort(bytte);
        });
        game.spillBunke.filter(b => (b.modus == "Best" && game.spillere[b.fra] == player)).forEach(bytte => {
            game.BytteKort_GiKort(bytte);
        });
    }
    if (game.status == "S" && player.sinTur == 1 && player.plassering == 0) {
        var kb = null;
        if (game.spillBunke.length == 0) {
            player.kort.forEach(kort => {
                kort._Antall = player.kort.filter(k => (k.verdiBoms == kort.verdiBoms)).length;
            });
            const valgtVerdiBoms = player.kort.sort((a, b) => (b._Antall - a._Antall))[0].verdiBoms;
            kb = new KortBunke(player.nick);
            player.kort.filter(k => (k.verdiBoms == valgtVerdiBoms)).forEach(kort => {
                kb.push(kort);
            })
        } else {
            player.kort.filter(kort => (game.KanLeggeKort(player, kort.verdiBoms))).forEach(kort => {
                if (kb == null || kort.verdiBoms < kb.verdiBoms) {
                    kb = new KortBunke(player.nick, kort);
                } else if (kort.verdiBoms == kb.verdiBoms && (kb.length < game.OversteKortBunke().length)) {
                    kb.push(kort);
                }
            })
        }
        if (kb != null) {
            game.LeggKort(player, kb);
        } else {
            game.SpillerPass(player);
        }
    }
}