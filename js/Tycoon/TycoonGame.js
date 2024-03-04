class TycoonGame {
    constructor(id = null) {
        // Get a reference to the database service
        let database = firebase.database();
    }

    getPlayer(nickname) {
        return this.players.find(player => player.nickname === nickname) || null;
        //let ret = null;
        //this.players.filter(player => (player.nick == nickname)).forEach(player => {
        //    ret = player;
        //});
        //return ret;
    }

    startGame() {
        switch (this.status) {
            case "O":
            case "F":

                for (let i = this.players.length - 1; i > 0; i--) { // Fisher-Yates shuffle algorithm
                    let n = Math.floor(Math.random() * (i + 1));
                    let remember = this.players[i];
                    this.players[i] = this.players[n];
                    this.players[n] = remember;
                }
                this.players.forEach(player => {
                    player.resetRound(null);
                    player.hasTurn = 0;
                });
                this.round = 1;
                this.setHasTurn(0);
                this.startTime = Date.now();
                this.endTime = null;
                this.status = "S";
                break;
            default:
                throw ('Spillet har allerede startet.');
                break;
        }
    }

    setHasTurn(player) {
        this.players.forEach(player => { player.hasTurn = 0; })
        if (player == null) {
            this.hasTurn = -1;
        } else if (typeof player == "number") {
            this.hasTurn = player;
        } else if (typeof player == "string") {
            this.hasTurn = this.getPlayer(player);
        }
        if (this.hasTurn >= 0) {
            this.players[this.hasTurn].hasTurn = 1;
        }
    }

    gameId() {
        if (this.startTime != null) {
            if (this.endTime == null) {
                return Math.floor((Date.now() - this.startTime) / 60000);
            } else {
                return Math.floor((this.endTime - this.startTime) / 60000);
            }
        } else {
            return null;
        }
    }

    playerHasFinished(player, hasWon = true) {
        if (player.placement != 0) {
            return false;
        }

        let finalPlacement = ((hasWon) ? 0 : this.players.length + 1);
        do {
            finalPlacement += ((hasWon) ? 1 : -1);
            //Går i løkke helt til denne plasseringen er ledig.
        } while (this.players.filter(s => {
            return s.placement == finalPlacement;
        }).length >= 1);

        player.placement = finalPlacement;
        player.resetRound();
        return true;
    }

    nextPlayerSkip(hasTurn) {
        return false;
    }

    nextPlayerTurn() {
        if (this.hasTurn == -1 || this.status != "S" || this.hasTurn == null) {
            throw ('Game not running.')
        }

        let playedLastCards = this.players[this.hasTurn];
        playedLastCards.hasTurn = 0;

        let again = this.players.filter(player => {
            return player.placement == 0;
        });
        if (again.length <= 1) {
            this.playerHasFinished(again[0], false);
            this.endTime = Date.now();
            this.setHasTurn(-1);

            this.players = this.players.sort((a, b) => { return a.placement - b.placement; })
            if (!this.resultater) {
                this.resultater = [];
            };
            let resultat = [];
            this.players.forEach(player => {
                resultat.push(player.nickname)
            });
            this.resultater.push(resultat);
            this.status = "F";
            let game = this;

            setTimeout(function () {
                if (game.status == "F" || game.status == "O") {
                    let fikset = false;
                    game.players.filter(s => (s.melding.length > 0)).forEach(spiller => {
                        spiller.melding = [];
                        fikset = true;
                    });
                    if (fikset) { game.save(); };
                }
            }, 14000 + 2000 * Math.random()); //Litt tilfeldig tid, så ikke alle players gjør det på likt.
        } else {
            let nesteForsok = 0;
            let nesteSinTur = this.hasTurn;
            do {
                nesteSinTur = this.NesteSinTur_Neste(nesteSinTur, nesteForsok);
                nesteForsok++;
                while (nesteSinTur >= this.players.length) {
                    nesteSinTur -= this.players.length;
                    this.NesteSinTur_ForsteSpillerIgjen();
                }
                while (nesteSinTur < 0) {
                    nesteSinTur += this.players.length;
                }
            } while (this.nextPlayerSkip(nesteSinTur) || this.players[nesteSinTur].plassering != 0);
            this.setHasTurn(nesteSinTur);
            this.players[nesteSinTur].nullstillRunde(playedLastCards);
        }
        this.save();
    }

    addNewPlayer(player) {
        let nySpiller = null;
        this.players.forEach(erSpiller => {
            if (erSpiller.nick == player.nick) {
                if (erSpiller.spillerKey == player.spillerKey) {
                    nySpiller = { spiller: erSpiller };
                } else {
                    nyspiller = { tekst: 'Nick er allerede i bruk av annen spiller.' };
                }
            }
        });
        if (nySpiller != null) { return nySpiller };
        switch (this.status) {
            case "F":
                this.GaaTilOppsett();
            case 'O':
                this.players.push(player);
                this.save();
                return { spiller: player };
                break;
            default:
                return { tekst: 'Ingen nye players når spillet pågår.' };
                break;
        }
    }

    terminatePlayer(player) {
        switch (this.status) {
            case 'O':
            case "F":
                this.players = this.players.filter(s => { return s !== player; });
                this.save();
                return null;
                break;
            case 'S':
                this.playerHasFinished(player, false);
                if (player.sinTur == 1) {
                    this.nextPlayerTurn();
                } else {
                    this.save();
                }
                player.melding.push("Gir opp!");
                return player;
                break;
            default:
                throw ('Kan ikke gi opp nå.');
                break;
        }
    }

    GaaTilOppsett() {
        //Omgjør et ferdig spill til et spill som skal settes opp for å spille litt til.
        if (this.status == "S") { throw ("Kan ikke gå til oppsett før spillet er ferdig.") }
        this.players.forEach(spiller => {
            spiller.plassering = 0;
            spiller.kort = [];
        });
        this.status = "O";
        this.save();
    }
}