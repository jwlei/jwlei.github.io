class TycoonGame {
    constructor(id = null) {
        // Get a reference to the database service
        var database = firebase.database();
    }

    save() {
        throw ("Må implementeres");
    }

    StartSpillFix() {
        throw ("Må implementeres");
    }

    getPlayer(nickname) {
        return this.players.find(player => player.nick === nickname) || null;
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
                //Bland spillerrekkefølge
                for (let i = this.players.length - 1; i > 0; i--) {
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
                this.setSinTur(0);
                this.startTime = Date.now();
                this.endTime = null;
                this.status = "S";
                //Fiks individuelle ting pr spill
                this.StartSpillFix();
                //Start spillet
                this.save();
                break;
            default:
                throw ('Spillet har allerede startet.');
                break;
        }
    }

    setSinTur(spiller) {
        this.players.forEach(spiller => { spiller.sinTur = 0; })
        if (spiller == null) {
            this.hasTurn = -1;
        } else if (typeof spiller == "number") {
            this.hasTurn = spiller;
        } else if (typeof spiller == "string") {
            this.hasTurn = this.getPlayer(spiller);
        }
        if (this.hasTurn >= 0) {
            this.players[this.hasTurn].sinTur = 1;
        }
    }

    SpillTid() {
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
        //Kan overskrives når det har gått en round rundt bordet, i tilfelle noe må gjøres da.
    }

    NesteSinTur() {
        if (this.hasTurn == -1 || this.status != "S" || this.hasTurn == null) { throw ('Spillet er ikke i gang.') }
        var varSinTur = this.players[this.hasTurn];
        varSinTur.sinTur = 0;
        var igjen = this.players.filter(spiller => { return spiller.plassering == 0; });
        if (igjen.length <= 1) {
            this.SpillerFerdig(igjen[0], false);
            this.endTime = Date.now();
            this.setSinTur(-1);
            this.players = this.players.sort((a, b) => { return a.plassering - b.plassering; })
            if (!this.resultater) { this.resultater = []; };
            var resultat = [];
            this.players.forEach(spiller => {
                resultat.push(spiller.nick)
            });
            this.resultater.push(resultat);
            this.status = "F";
            var spill = this;
            setTimeout(function () {
                if (spill.status == "F" || spill.status == "O") {
                    var fikset = false;
                    spill.players.filter(s => (s.melding.length > 0)).forEach(spiller => {
                        spiller.melding = [];
                        fikset = true;
                    });
                    if (fikset) { spill.save(); };
                }
            }, 14000 + 2000 * Math.random()); //Litt tilfeldig tid, så ikke alle players gjør det på likt.
        } else {
            var nesteForsok = 0;
            var nesteSinTur = this.hasTurn;
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
        this.save();
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
        switch (this.status) {
            case "F":
                this.GaaTilOppsett();
            case 'O':
                this.players.push(spiller_inn);
                this.save();
                return { spiller: spiller_inn };
                break;
            default:
                return { tekst: 'Ingen nye players når spillet pågår.' };
                break;
        }
    }

    AvsluttSpiller(spiller) {
        switch (this.status) {
            case 'O':
            case "F":
                this.players = this.players.filter(s => { return s !== spiller; });
                this.save();
                return null;
                break;
            case 'S':
                this.SpillerFerdig(spiller, false);
                if (spiller.sinTur == 1) {
                    this.NesteSinTur();
                } else {
                    this.save();
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
        if (this.status == "S") { throw ("Kan ikke gå til oppsett før spillet er ferdig.") }
        this.players.forEach(spiller => {
            spiller.plassering = 0;
            spiller.kort = [];
        });
        this.status = "O";
        this.save();
    }
}