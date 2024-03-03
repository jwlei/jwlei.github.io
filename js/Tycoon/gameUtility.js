class GameUtility extends TycoonGame {
    constructor(id = null) {
        super(id);
        this.debug = true;
        // Get a reference to the database service
        if (id == null) {
            this.gameId = Math.floor(Math.random() * 999999 + 1).toString();
            this.dbReference = firebase.database().ref(`tycoon_game/${this.gameId}`);
            this.rules = {
                onlyShowCards: false
            };
            this.status = 'O'; //O=Oppstart, G=Gir card S=player, F=Ferdig
            this.round = 0;
            this.players = [];
            this.cardsOnTable = [];
            this.hasTurn = -1;
            this.save();
        } else {
            this.gameId = id;
            this.dbReference = firebase.database().ref(`boms_1/${this.gameId}`);
            //PS: Skal ikke "lagre" her, da spillet skal hentes.
        }
    }

    save() {
        //console.log(JSON.stringify(this));
        this.dbReference.set({
            status: this.status,
            rules: this.rules,
            round: this.round,
            players: TycoonPlayer.getPlayers(this.players),
            cardsOnTable: this.cardsOnTable,
            hasTurn: this.hasTurn,
            timestamp: new Date()
        });
    }

    getNumberOfDecks() {
        return 1;
    }

    playerTitle(placement) {
        if (this.players.length >= 5) {
            switch (placement) {
                case 1:
                    return ({ tittel: "President", img: "00President.png" });
                case 2:
                    return ({ tittel: "Visepresident", img: "00VisePres.png" });
                case this.players.length - 1:
                    return ({ tittel: "Viseboms", img: "00ViseBoms.png" });
                case this.players.length:
                    return ({ tittel: "Boms", img: "00Boms.png" });
                default:
                    return ({ tittel: `Arbeider${((this.players.length > 5) ? " " + (placement - 2) : "")}`, img: "00Arbeider.png" });
            }
        } else {
            switch (placement) {
                case 1:
                    return ({ tittel: "President", img: "00President.png" });
                case this.players.length:
                    return ({ tittel: "Boms", img: "00Boms.png" });
                default:
                    return ({ tittel: `Arbeider${((this.players.length > 3) ? " " + (placement - 1) : "")}`, img: "00Arbeider.png" });
            }
        }
    }

    StartSpillFix() {
        //Fiks kortstokk
        var kortstokk = new Kortstokk();
        for (let i = this.getNumberOfDecks(); i > 0; i--) {
            kortstokk.LeggTil52Kort(function (farge, verdi) { return new KortBoms(farge, verdi); });
        }
        // Tar ut card som ikke skal vÃ¦re med
        kortstokk.Sorter();
        kortstokk.splice(0, kortstokk.length % this.players.length);
        // Stokker og deler ut
        kortstokk.Bland();
        this.players.forEach(spiller => {
            spiller.kort = new Kortstokk();
        });
        while (kortstokk.length > 0) {
            this.players.forEach(spiller => {
                spiller.kort.push(kortstokk.pop());
            });
        }
        // Fiks rekkefÃ¸lge og gi card hvis det har vÃ¦rt et tidligere spill
        if (this.players.filter(s => (s.plassering != 0)).length > 0) {
            //game i rekkefÃ¸lge, og bytt card.
            this.players.filter(s => (s.plassering == 0)).forEach(s => (s.plassering = 99)); //Evt nye players skal starte sist.
            this.players.sort((a, b) => a.plassering - b.plassering);
            this.players.forEach(spiller => {
                spiller.kort.Sorter();
                spiller.plassering = 0;
            });
            this.cardsOnTable = [];
            this.status = "G"; //Gi card til hverandre
            this.setSinTur(null);
            if (this.players.length >= 5) {
                this.players[0].melding.push("Skal gi to card til bomsen.");
                this.players[1].melding.push("Skal gi ett card til visebomsen.");
                this.players[this.players.length - 2].melding.push("Gir sitt dÃ¥rligste card til visepresidenten.");
                this.players[this.players.length - 1].melding.push("Gir sine to dÃ¥rligste card til presidenten.");
                this.cardsOnTable = [{
                    tekst: "Presidenten skal gi bomsen to card:",
                    fra: 0,
                    til: this.players.length - 1,
                    antall: 2,
                    modus: "Velg"
                }, {
                    tekst: "Visepresidenten skal gi visebomsen ett card:",
                    fra: 1,
                    til: this.players.length - 2,
                    antall: 1,
                    modus: "Velg"
                }, {
                    tekst: "Visebomsen skal gi visepresidenten sitt beste card:",
                    fra: this.players.length - 2,
                    til: 1,
                    antall: 1,
                    modus: "Best"
                }, {
                    tekst: "Bomsen skal gi presidenten sine to beste card:",
                    fra: this.players.length - 1,
                    til: 0,
                    antall: 2,
                    modus: "Best"
                }];
            } else {
                this.cardsOnTable = [{
                    tekst: "Presidenten skal gi bomsen ett card:",
                    fra: 0,
                    til: this.players.length - 1,
                    antall: 1,
                    modus: "Velg"
                }, {
                    tekst: "Bomsen skal gi presidenten sitt beste card:",
                    fra: this.players.length - 1,
                    til: 0,
                    antall: 1,
                    modus: "Best"
                }];
            }
            this.cardsOnTable.filter(bytte => (bytte.modus == "Best")).forEach(bytte => {
                bytte.kort = [];
                var kort = this.players[bytte.fra].kort.filter(k => (!k.Klover3())); //KlÃ¸ver 3 skal ikke gis.
                for (var i = 1; i <= bytte.antall; i++) {
                    bytte.kort.push(kort[kort.length - i]);
                }
            });
            this.setSinTur(null);
            this.cardsOnTable.filter(bytte => (bytte.modus == "Velg")).forEach(bytte => {
                this.players[bytte.fra].sinTur = 1;
            });
        } else {
            this.cardsOnTable = [];
            this.players.forEach(spiller => {
                spiller.kort.Sorter();
            });
        }
    }

    BytteKort_GiKort(bytte) {
        if (this.status != "G") { throw ("Spillet er ikke i bytte-modus."); };
        if (bytte.modus != 'Velg' && bytte.modus != 'Best') { throw (`Kan ikke gi card nÃ¥r modus er ${bytte.modus} (mÃ¥ vÃ¦re Velg eller Best).`); };
        if (bytte.kort.length != bytte.antall) { throw ("Feil antall card som byttes."); };
        bytte.kort.forEach(k => {
            this.players[bytte.fra].kort.splice(
                this.players[bytte.fra].kort.findIndex(k_ut => (k_ut.farge == k.farge && k_ut.verdi == k.verdi)),
                1
            );
        });
        bytte.modus = "Gitt";
        if (this.cardsOnTable.filter(b => (b.modus != "Gitt")).length == 0) {
            //Alle har gitt
            this.cardsOnTable.forEach(bytte => {
                bytte.modus = "Kan se";
            });
            this.setSinTur(-1);
        }
        this.save();
    }

    BytteKort_FaaKort(bytte) {
        if (this.status != "G") { throw ("Spillet er ikke i bytte-modus."); };
        if (bytte.modus != 'Kan se') { throw (`Kan ikke gi card nÃ¥r modus er ${bytte.modus} (mÃ¥ vÃ¦re Kan se).`); };
        if (bytte.kort.length != bytte.antall) { throw ("Feil antall card som byttes."); };
        bytte.kort.forEach(k => {
            this.players[bytte.til].kort.push(new KortBoms(k.farge, k.verdi));
        });
        this.players[bytte.til].kort.Sorter();
        this.cardsOnTable.splice(this.cardsOnTable.findIndex(b => (b == bytte)), 1);
        if (this.cardsOnTable.length == 0) {
            //Alle bytter gjennomfÃ¸rt
            this.status = "S";
            this.setSinTur(0);
        }
        this.save();
    }

    OversteKortBunke() {
        if (this.cardsOnTable.length == 0) { return null; }
        return this.cardsOnTable[this.cardsOnTable.length - 1];
    }

    KanLeggeKort(spiller, verdiBoms, returInfo = {}) {
        // Sjekker om en gitt value kan legges.
        // Sjekker bÃ¥de at spilleren har card som passer og at det kan legges.
        // Kortene merkes og returInfo inneholder kortbunke som kan legges pÃ¥. (FÃ¸rste runda elle mulige som kan legges pÃ¥ med den tycoonValue.)
        if (this.status != "S") {
            returInfo.svar = false;
            returInfo.tekst = "Spillet har ikke startet.";
            return false;
        }
        if (spiller == null || spiller.sinTur != 1) {
            returInfo.svar = false;
            returInfo.tekst = "Ikke din tur.";
            return false;
        };
        if (this.cardsOnTable.length == 0) {
            //Kan legge hva som helst i starten.
            var kb = new CardsOnTable(spiller.nick);
            spiller.kort.forEach(kort => {
                if (kort.verdiBoms == verdiBoms) {
                    kb.push(kort);
                    kort._Merket = true;
                } else {
                    kort._Merket = false;
                }
            });
            returInfo.svar = true;
            returInfo.kb = kb;
            return true;
        };
        var oversteKB = this.OversteKortBunke();
        if (verdiBoms < oversteKB.verdiBoms) {
            returInfo.svar = false;
            returInfo.tekst = `MÃ¥ legge pÃ¥ ${oversteKB.verdiBoms} eller hÃ¸yere.`;
            return false;
        };
        var antallKort = ((verdiBoms == KortBoms.Klover3verdi()) ? 1 : antallKort = oversteKB.length);
        var kb = new CardsOnTable(spiller.nick);
        var n = 0;
        spiller.kort.forEach(k => {
            if (n < antallKort && k.verdiBoms == verdiBoms) {
                kb.push(k);
                n++;
                k._Merket = true;
            } else {
                k._Merket = false;
            }
        });
        if (kb.length < antallKort) {
            spiller.kort.forEach(k => { k._Merket = false; });
            returInfo.svar = false;
            returInfo.tekst = `Du mÃ¥ ha ${antallKort} like card.`;
            return false;
        };
        returInfo.svar = true;
        returInfo.kb = kb;
        return true;
    }

    KanLeggeKortBunke(spiller, kb) {
        return spiller != null &&
            kb != null &&
            this.status == "S" &&
            spiller.sinTur == 1 &&
            spiller.nick == kb.nick &&
            kb.KanLeggesPa(this.OversteKortBunke()) &&
            spiller.kort.filter(k => (kb.includes(k))).length == kb.length;
    }

    SpillBunkeGarUt(info = {}) {
        var overst = this.OversteKortBunke();
        if (overst == null) { return false; } //Ingen card, da gÃ¥r det ikke ut.
        if (overst[0].Klover3()) {
            info.tekst = "KlÃ¸ver 3";
            return true;
        }
        var verdi = overst.verdiBoms;
        var antall = 0;
        var kb;
        var i = this.cardsOnTable.length;
        do {
            i--;
            kb = this.cardsOnTable[i];
            antall += kb.length;
        } while (i > 0 && antall < 4 && kb.verdiBoms == verdi);
        if (antall >= 4 && kb.verdiBoms == verdi) {
            info.tekst = `Fire ${Kort.VerdiNavn(kb[0].verdi).navnflertall}`;
            return true;
        }
        if (this.players.filter(spiller => (spiller.laPaaSist != "Pass" && spiller.plassering == 0)).length <= 1) {
            info.tekst = "Alle players sa pass";
            return true;
        }
        return false;
    }

    LeggKort(spiller, kb) {
        if (!this.KanLeggeKortBunke(spiller, kb)) { throw ("Kan ikke legge dette nÃ¥!"); };
        if (this.cardsOnTable.length == 0) {
            this.players.filter(s => (s.plassering > 0 && s.melding.length > 0)).forEach(s => {
                s.melding = [];
            });
        }
        kb.forEach(leggKort => {
            var i = spiller.kort.findIndex(k => (k == leggKort));
            spiller.kort.splice(i, 1);
        });
        spiller.laPaaSist = kb;
        this.cardsOnTable.push(kb);
        if (spiller.kort.length == 0) {
            if (kb.verdiBoms == KortBoms.Klover3verdi()) {
                // Hvis man legger KlÃ¸ver 3 som siste card, sÃ¥ taper man:
                this.SpillerFerdig(spiller, false);
            } else {
                // Ferdig pÃ¥ riktig mÃ¥te:
                this.SpillerFerdig(spiller);
            }
        }
        this.NesteSinTur();
    }

    SpillerKanPasse(spiller) {
        return spiller != null &&
            this.status == "S" &&
            spiller.sinTur == 1;
    }

    SpillerPass(spiller) {
        spiller.laPaaSist = "Pass";
        this.NesteSinTur();
    }

    NesteSinTur_Neste(varSinTur) {
        var info = {};
        if (this.SpillBunkeGarUt(info)) {
            var spillerSist = this.players[varSinTur];
            //if (typeof spillerSist.playedLastTurn == "CardsOnTable") {
            if (spillerSist.laPaaSist) {
                spillerSist.melding.push(`${((spillerSist.laPaaSist.Tekst) ? "La pÃ¥ " + spillerSist.laPaaSist.Tekst() : spillerSist.laPaaSist)}, bunken gÃ¥r ut. (${info.tekst})`);
            } else {
                spillerSist.melding.push(`Bunken gikk ut og ferdig. (${info.tekst})`);
            }
            this.round++;
            this.players.forEach(spiller => {
                spiller.laPaaSist = null;
            });
            //Finn den som la pÃ¥ sist, og som har card igjen pÃ¥ hÃ¥nden.
            var nesteNick = null;
            this.cardsOnTable.forEach(kb => {
                if (this.getSpiller(kb.nick).kort.length > 0) {
                    nesteNick = kb.nick;
                }
            });
            if (nesteNick == null) {
                //Hvis ingen av de som la pÃ¥ i runden har card igjen, sÃ¥ gÃ¥r vi baklengs for Ã¥ finne neste som legger pÃ¥.
                nesteNick = this.OversteKortBunke().nick;
                var huskIndex = this.players.findIndex(spiller => (spiller.nick == nesteNick));
                do {
                    huskIndex--;
                    if (huskIndex < 0) { huskIndex += this.players.length; };
                } while (this.players[huskIndex].plassering > 0);
                this.cardsOnTable = [];
                return huskIndex;
            }
            this.cardsOnTable = [];
            return this.players.findIndex(spiller => (spiller.nick == nesteNick));
        } else {
            return varSinTur + 1;
        }
    }

    NesteSinTur_HoppOver(sinTur) {
        return (this.players[sinTur].laPaaSist == "Pass");
    }
}