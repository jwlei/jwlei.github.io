class Player {
    constructor(nickname, playerId) {
        this.nickname = nickname;
        this.playerId = playerId;
        this.placement = 0;
        this.cards = [];
        this.hasTurn = 0;
        this.message = [];
        this.playedLatestCards = null;
    }

    getValues() {
        return {
            nickname: this.nickname,
            playerId: this.playerId,
            placement: this.placement,
            cards: this.cards,
            hasTurn: this.hasTurn,
            message: this.message,
            playedLatesCards: this.playedLatestCards ?? []
            /*
            * Nullish Coalescing Operator
            * It sets the playedLastTurn property of the returned object to:
            * An empty array [] if this.playedLastTurn is null.
            * The current value of this.playedLastTurn if it is not null.
            */
        };
    }

    setValues(playerObject) {
        this.nickname = playerObject.nickname;
        this.playerId = playerObject.playerId;
        this.placement = playerObject.placement;
        this.cards = playerObject.cards;
        this.hasTurn = playerObject.hasTurn;
        this.message = this.message ?? []
        this.playedLatestCards = playerObject.playedLatestCards;
        return this;
    }

    resetTurn(playerObjectHadTurn) {
        if (this != playerObjectHadTurn) {
            this.message = [];
        }
    }
}

class GameUtility {
    constructor(id = null) {
        // Get a reference to the database service
        let database = firebase.database();
    }

    getPlayer(nickname) {
        // Return the player object with the given nickname
        return this.players.filter(player => (player.nickname == nickname));
    }

    startGame() {
        switch (this.gameStatus) {
            case "O":
            case "F":
                //Bland spillerrekkefølge
                for (var i = this.players.length - 1; i > 0; i--) {
                    var n = Math.floor(Math.random() * (i + 1));
                    var husk = this.players[i];
                    this.players[i] = this.players[n];
                    this.players[n] = husk;
                }
                this.players.forEach(player => {
                    player.resetTurn(null);
                    player.sinTur = 0;
                });
                this.runde = 1;
                this.setSinTur(0);
                this.startTid = Date.now();
                this.sluttTid = null;
                this.gameStatus = "S";
                //Fiks individuelle ting pr spill
                this.StartSpillFix();
                //Start spillet
                this.Save();
                break;
            default:
                throw ('Spillet har allerede startet.');
                break;
        }
    }

    setSinTur(spiller) {
        this.players.forEach(spiller => { spiller.sinTur = 0; })
        if (spiller == null) {
            this.sinTur = -1;
        } else if (typeof spiller == "number") {
            this.sinTur = spiller;
        } else if (typeof spiller == "string") {
            this.sinTur = this.getPlayer(spiller);
        }
        if (this.sinTur >= 0) {
            this.players[this.sinTur].sinTur = 1;
        }
    }

    SpillTid() {
        if (this.startTid != null) {
            if (this.sluttTid == null) {
                return Math.floor((Date.now() - this.startTid) / 60000);
            } else {
                return Math.floor((this.sluttTid - this.startTid) / 60000);
            }
        } else {
            return null;
        }
    }

    SpillerFerdig(spiller, vunnet = true) {
        if (spiller.plassering != 0) { return false; }
        var finnPlass = ((vunnet) ? 0 : this.players.length + 1);
        do {
            finnPlass += ((vunnet) ? 1 : -1);
            //Går i løkke helt til denne plasseringen er ledig.
        } while (this.players.filter(s => {
            return s.plassering == finnPlass;
        }).length >= 1);
        spiller.plassering = finnPlass;
        spiller.nullstillRunde();
        return true;
    }

    NesteSinTur_Neste(varSinTur) {
        throw ("Må kodes!");
        //Eksempel:
        //return varSinTur+1;
    }

    NesteSinTur_HoppOver(sinTur) {
        return false;
        //Kan overskrives hvis noen players skal hoppes over.
        //(Spillere som har fått en placement hoppes automatisk over.)
    }

    NesteSinTur_ForsteSpillerIgjen() {
        //Kan overskrives når det har gått en runde rundt bordet, i tilfelle noe må gjøres da.
    }

    NesteSinTur() {
        if (this.sinTur == -1 || this.gameStatus != "S" || this.sinTur == null) { throw ('Spillet er ikke i gang.') }
        var varSinTur = this.players[this.sinTur];
        varSinTur.sinTur = 0;
        var igjen = this.players.filter(spiller => { return spiller.plassering == 0; });
        if (igjen.length <= 1) {
            this.SpillerFerdig(igjen[0], false);
            this.sluttTid = Date.now();
            this.setSinTur(-1);
            this.players = this.players.sort((a, b) => { return a.plassering - b.plassering; })
            if (!this.resultater) { this.resultater = []; };
            var resultat = [];
            this.players.forEach(spiller => {
                resultat.push(spiller.nick)
            });
            this.resultater.push(resultat);
            this.gameStatus = "F";
            var spill = this;
            setTimeout(function () {
                if (spill.gameStatus == "F" || spill.gameStatus == "O") {
                    var fikset = false;
                    spill.players.filter(s => (s.melding.length > 0)).forEach(spiller => {
                        spiller.melding = [];
                        fikset = true;
                    });
                    if (fikset) { spill.Save(); };
                }
            }, 14000 + 2000 * Math.random()); //Litt tilfeldig tid, så ikke alle players gjør det på likt.
        } else {
            var nesteForsok = 0;
            var nesteSinTur = this.sinTur;
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
            } while (this.NesteSinTur_HoppOver(nesteSinTur) || this.players[nesteSinTur].plassering != 0);
            this.setSinTur(nesteSinTur);
            this.players[nesteSinTur].nullstillRunde(varSinTur);
        }
        this.Save();
    }

    NySpiller(spiller_inn) {
        var nySpiller = null;
        this.players.forEach(erSpiller => {
            if (erSpiller.nick == spiller_inn.nick) {
                if (erSpiller.spillerKey == spiller_inn.spillerKey) {
                    nySpiller = { spiller: erSpiller };
                } else {
                    nyspiller = { tekst: 'Nick er allerede i bruk av annen spiller.' };
                }
            }
        });
        if (nySpiller != null) { return nySpiller };
        switch (this.gameStatus) {
            case "F":
                this.GaaTilOppsett();
            case 'O':
                this.players.push(spiller_inn);
                this.Save();
                return { spiller: spiller_inn };
                break;
            default:
                return { tekst: 'Ingen nye players når spillet pågår.' };
                break;
        }
    }

    AvsluttSpiller(spiller) {
        switch (this.gameStatus) {
            case 'O':
            case "F":
                this.players = this.players.filter(s => { return s !== spiller; });
                this.Save();
                return null;
                break;
            case 'S':
                this.SpillerFerdig(spiller, false);
                if (spiller.sinTur == 1) {
                    this.NesteSinTur();
                } else {
                    this.Save();
                }
                spiller.melding.push("Gir opp!");
                return spiller;
                break;
            default:
                throw ('Kan ikke gi opp nå.');
                break;
        }
    }

    GaaTilOppsett() {
        //Omgjør et ferdig spill til et spill som skal settes opp for å spille litt til.
        if (this.gameStatus == "S") { throw ("Kan ikke gå til oppsett før spillet er ferdig.") }
        this.players.forEach(spiller => {
            spiller.plassering = 0;
            spiller.kort = [];
        });
        this.gameStatus = "O";
        this.Save();
    }
}