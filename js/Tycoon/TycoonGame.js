class TycoonGame {
    constructor(id = null) {
        // Get a reference to the database service
        var database = firebase.database();
    }
    Lagre() {
        throw ("Må implementeres");
    }
    getPlayer(nick) {
        var ret = null;
        this.spillere.filter(spiller => (spiller.nick == nick)).forEach(spiller => {
            ret = spiller;
        });
        return ret;
    }
    StartSpillFix() {
        throw ("Må implementeres");
    }
    startGame() {
        switch (this.status) {
            case "O":
            case "F":
                //Bland spillerrekkefølge
                for (var i = this.spillere.length - 1; i > 0; i--) {
                    var n = Math.floor(Math.random() * (i + 1));
                    var husk = this.spillere[i];
                    this.spillere[i] = this.spillere[n];
                    this.spillere[n] = husk;
                }
                this.spillere.forEach(spiller => {
                    spiller.nullstillRunde(null);
                    spiller.sinTur = 0;
                });
                this.runde = 1;
                this.setSinTur(0);
                this.startTid = Date.now();
                this.sluttTid = null;
                this.status = "S";
                //Fiks individuelle ting pr spill
                this.StartSpillFix();
                //Start spillet
                this.Lagre();
                break;
            default:
                throw ('Spillet har allerede startet.');
                break;
        }
    }
    setSinTur(spiller) {
        this.spillere.forEach(spiller => { spiller.sinTur = 0; })
        if (spiller == null) {
            this.sinTur = -1;
        } else if (typeof spiller == "number") {
            this.sinTur = spiller;
        } else if (typeof spiller == "string") {
            this.sinTur = this.getPlayer(spiller);
        }
        if (this.sinTur >= 0) {
            this.spillere[this.sinTur].sinTur = 1;
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
        var finnPlass = ((vunnet) ? 0 : this.spillere.length + 1);
        do {
            finnPlass += ((vunnet) ? 1 : -1);
            //Går i løkke helt til denne plasseringen er ledig.
        } while (this.spillere.filter(s => {
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
        //Kan overskrives hvis noen spillere skal hoppes over.
        //(Spillere som har fått en plassering hoppes automatisk over.)
    }
    NesteSinTur_ForsteSpillerIgjen() {
        //Kan overskrives når det har gått en runde rundt bordet, i tilfelle noe må gjøres da.
    }
    NesteSinTur() {
        if (this.sinTur == -1 || this.status != "S" || this.sinTur == null) { throw ('Spillet er ikke i gang.') }
        var varSinTur = this.spillere[this.sinTur];
        varSinTur.sinTur = 0;
        var igjen = this.spillere.filter(spiller => { return spiller.plassering == 0; });
        if (igjen.length <= 1) {
            this.SpillerFerdig(igjen[0], false);
            this.sluttTid = Date.now();
            this.setSinTur(-1);
            this.spillere = this.spillere.sort((a, b) => { return a.plassering - b.plassering; })
            if (!this.resultater) { this.resultater = []; };
            var resultat = [];
            this.spillere.forEach(spiller => {
                resultat.push(spiller.nick)
            });
            this.resultater.push(resultat);
            this.status = "F";
            var spill = this;
            setTimeout(function () {
                if (spill.status == "F" || spill.status == "O") {
                    var fikset = false;
                    spill.spillere.filter(s => (s.melding.length > 0)).forEach(spiller => {
                        spiller.melding = [];
                        fikset = true;
                    });
                    if (fikset) { spill.Lagre(); };
                }
            }, 14000 + 2000 * Math.random()); //Litt tilfeldig tid, så ikke alle spillere gjør det på likt.
        } else {
            var nesteForsok = 0;
            var nesteSinTur = this.sinTur;
            do {
                nesteSinTur = this.NesteSinTur_Neste(nesteSinTur, nesteForsok);
                nesteForsok++;
                while (nesteSinTur >= this.spillere.length) {
                    nesteSinTur -= this.spillere.length;
                    this.NesteSinTur_ForsteSpillerIgjen();
                }
                while (nesteSinTur < 0) {
                    nesteSinTur += this.spillere.length;
                }
            } while (this.NesteSinTur_HoppOver(nesteSinTur) || this.spillere[nesteSinTur].plassering != 0);
            this.setSinTur(nesteSinTur);
            this.spillere[nesteSinTur].nullstillRunde(varSinTur);
        }
        this.Lagre();
    }
    NySpiller(spiller_inn) {
        var nySpiller = null;
        this.spillere.forEach(erSpiller => {
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
                this.spillere.push(spiller_inn);
                this.Lagre();
                return { spiller: spiller_inn };
                break;
            default:
                return { tekst: 'Ingen nye spillere når spillet pågår.' };
                break;
        }
    }
    AvsluttSpiller(spiller) {
        switch (this.status) {
            case 'O':
            case "F":
                this.spillere = this.spillere.filter(s => { return s !== spiller; });
                this.Lagre();
                return null;
                break;
            case 'S':
                this.SpillerFerdig(spiller, false);
                if (spiller.sinTur == 1) {
                    this.NesteSinTur();
                } else {
                    this.Lagre();
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
        this.spillere.forEach(spiller => {
            spiller.plassering = 0;
            spiller.kort = [];
        });
        this.status = "O";
        this.Lagre();
    }
}