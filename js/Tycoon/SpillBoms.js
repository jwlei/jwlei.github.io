class SpillBoms extends game {
    constructor(id = null) {
        super(id);
        this.debug = true;
        // Get a reference to the database service
        if (id == null) {
            this.spillId = Math.floor(Math.random() * 999999 + 1).toString();
            this.databaseRef = firebase.database().ref(`boms_1/${this.spillId}`);
            this.regler = {
                VisKunKort: false
            };
            this.status = 'O'; //O=Oppstart, G=Gir kort S=player, F=Ferdig
            this.runde = 0;
            this.spillere = [];
            this.spillBunke = [];
            this.sinTur = -1;
            this.Lagre();
        } else {
            this.spillId = id;
            this.databaseRef = firebase.database().ref(`boms_1/${this.spillId}`);
            //PS: Skal ikke "lagre" her, da spillet skal hentes.
        }
    }
    Lagre() {
        //console.log(JSON.stringify(this));
        this.databaseRef.set({
            status: this.status,
            regler: this.regler,
            runde: this.runde,
            spillere: SpillerBoms.Spillere_get(this.spillere),
            spillBunke: this.spillBunke,
            sinTur: this.sinTur,
            ts: new Date()
        });
    }
    BeregnAntKortstokker() {
        return 1;
    }
    spillerTittel(plassering) {
        if (this.spillere.length >= 5) {
            switch (plassering) {
                case 1:
                    return ({ tittel: "President", img: "00President.png" });
                case 2:
                    return ({ tittel: "Visepresident", img: "00VisePres.png" });
                case this.spillere.length - 1:
                    return ({ tittel: "Viseboms", img: "00ViseBoms.png" });
                case this.spillere.length:
                    return ({ tittel: "Boms", img: "00Boms.png" });
                default:
                    return ({ tittel: `Arbeider${((this.spillere.length > 5) ? " " + (plassering - 2) : "")}`, img: "00Arbeider.png" });
            }
        } else {
            switch (plassering) {
                case 1:
                    return ({ tittel: "President", img: "00President.png" });
                case this.spillere.length:
                    return ({ tittel: "Boms", img: "00Boms.png" });
                default:
                    return ({ tittel: `Arbeider${((this.spillere.length > 3) ? " " + (plassering - 1) : "")}`, img: "00Arbeider.png" });
            }
        }
    }
    StartSpillFix() {
        //Fiks kortstokk
        var kortstokk = new Kortstokk();
        for (let i = this.BeregnAntKortstokker(); i > 0; i--) {
            kortstokk.LeggTil52Kort(function (farge, verdi) { return new KortBoms(farge, verdi); });
        }
        // Tar ut kort som ikke skal vÃ¦re med
        kortstokk.Sorter();
        kortstokk.splice(0, kortstokk.length % this.spillere.length);
        // Stokker og deler ut
        kortstokk.Bland();
        this.spillere.forEach(spiller => {
            spiller.kort = new Kortstokk();
        });
        while (kortstokk.length > 0) {
            this.spillere.forEach(spiller => {
                spiller.kort.push(kortstokk.pop());
            });
        }
        // Fiks rekkefÃ¸lge og gi kort hvis det har vÃ¦rt et tidligere spill
        if (this.spillere.filter(s => (s.plassering != 0)).length > 0) {
            //game i rekkefÃ¸lge, og bytt kort.
            this.spillere.filter(s => (s.plassering == 0)).forEach(s => (s.plassering = 99)); //Evt nye spillere skal starte sist.
            this.spillere.sort((a, b) => a.plassering - b.plassering);
            this.spillere.forEach(spiller => {
                spiller.kort.Sorter();
                spiller.plassering = 0;
            });
            this.spillBunke = [];
            this.status = "G"; //Gi kort til hverandre
            this.setSinTur(null);
            if (this.spillere.length >= 5) {
                this.spillere[0].melding.push("Skal gi to kort til bomsen.");
                this.spillere[1].melding.push("Skal gi ett kort til visebomsen.");
                this.spillere[this.spillere.length - 2].melding.push("Gir sitt dÃ¥rligste kort til visepresidenten.");
                this.spillere[this.spillere.length - 1].melding.push("Gir sine to dÃ¥rligste kort til presidenten.");
                this.spillBunke = [{
                    tekst: "Presidenten skal gi bomsen to kort:",
                    fra: 0,
                    til: this.spillere.length - 1,
                    antall: 2,
                    modus: "Velg"
                }, {
                    tekst: "Visepresidenten skal gi visebomsen ett kort:",
                    fra: 1,
                    til: this.spillere.length - 2,
                    antall: 1,
                    modus: "Velg"
                }, {
                    tekst: "Visebomsen skal gi visepresidenten sitt beste kort:",
                    fra: this.spillere.length - 2,
                    til: 1,
                    antall: 1,
                    modus: "Best"
                }, {
                    tekst: "Bomsen skal gi presidenten sine to beste kort:",
                    fra: this.spillere.length - 1,
                    til: 0,
                    antall: 2,
                    modus: "Best"
                }];
            } else {
                this.spillBunke = [{
                    tekst: "Presidenten skal gi bomsen ett kort:",
                    fra: 0,
                    til: this.spillere.length - 1,
                    antall: 1,
                    modus: "Velg"
                }, {
                    tekst: "Bomsen skal gi presidenten sitt beste kort:",
                    fra: this.spillere.length - 1,
                    til: 0,
                    antall: 1,
                    modus: "Best"
                }];
            }
            this.spillBunke.filter(bytte => (bytte.modus == "Best")).forEach(bytte => {
                bytte.kort = [];
                var kort = this.spillere[bytte.fra].kort.filter(k => (!k.Klover3())); //KlÃ¸ver 3 skal ikke gis.
                for (var i = 1; i <= bytte.antall; i++) {
                    bytte.kort.push(kort[kort.length - i]);
                }
            });
            this.setSinTur(null);
            this.spillBunke.filter(bytte => (bytte.modus == "Velg")).forEach(bytte => {
                this.spillere[bytte.fra].sinTur = 1;
            });
        } else {
            this.spillBunke = [];
            this.spillere.forEach(spiller => {
                spiller.kort.Sorter();
            });
        }
    }
    BytteKort_GiKort(bytte) {
        if (this.status != "G") { throw ("Spillet er ikke i bytte-modus."); };
        if (bytte.modus != 'Velg' && bytte.modus != 'Best') { throw (`Kan ikke gi kort nÃ¥r modus er ${bytte.modus} (mÃ¥ vÃ¦re Velg eller Best).`); };
        if (bytte.kort.length != bytte.antall) { throw ("Feil antall kort som byttes."); };
        bytte.kort.forEach(k => {
            this.spillere[bytte.fra].kort.splice(
                this.spillere[bytte.fra].kort.findIndex(k_ut => (k_ut.farge == k.farge && k_ut.verdi == k.verdi)),
                1
            );
        });
        bytte.modus = "Gitt";
        if (this.spillBunke.filter(b => (b.modus != "Gitt")).length == 0) {
            //Alle har gitt
            this.spillBunke.forEach(bytte => {
                bytte.modus = "Kan se";
            });
            this.setSinTur(-1);
        }
        this.Lagre();
    }
    BytteKort_FaaKort(bytte) {
        if (this.status != "G") { throw ("Spillet er ikke i bytte-modus."); };
        if (bytte.modus != 'Kan se') { throw (`Kan ikke gi kort nÃ¥r modus er ${bytte.modus} (mÃ¥ vÃ¦re Kan se).`); };
        if (bytte.kort.length != bytte.antall) { throw ("Feil antall kort som byttes."); };
        bytte.kort.forEach(k => {
            this.spillere[bytte.til].kort.push(new KortBoms(k.farge, k.verdi));
        });
        this.spillere[bytte.til].kort.Sorter();
        this.spillBunke.splice(this.spillBunke.findIndex(b => (b == bytte)), 1);
        if (this.spillBunke.length == 0) {
            //Alle bytter gjennomfÃ¸rt
            this.status = "S";
            this.setSinTur(0);
        }
        this.Lagre();
    }
    OversteKortBunke() {
        if (this.spillBunke.length == 0) { return null; }
        return this.spillBunke[this.spillBunke.length - 1];
    }
    KanLeggeKort(spiller, verdiBoms, returInfo = {}) {
        // Sjekker om en gitt verdi kan legges.
        // Sjekker bÃ¥de at spilleren har kort som passer og at det kan legges.
        // Kortene merkes og returInfo inneholder kortbunke som kan legges pÃ¥. (FÃ¸rste runda elle mulige som kan legges pÃ¥ med den verdiBoms.)
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
        if (this.spillBunke.length == 0) {
            //Kan legge hva som helst i starten.
            var kb = new KortBunke(spiller.nick);
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
        var kb = new KortBunke(spiller.nick);
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
            returInfo.tekst = `Du mÃ¥ ha ${antallKort} like kort.`;
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
        if (overst == null) { return false; } //Ingen kort, da gÃ¥r det ikke ut.
        if (overst[0].Klover3()) {
            info.tekst = "KlÃ¸ver 3";
            return true;
        }
        var verdi = overst.verdiBoms;
        var antall = 0;
        var kb;
        var i = this.spillBunke.length;
        do {
            i--;
            kb = this.spillBunke[i];
            antall += kb.length;
        } while (i > 0 && antall < 4 && kb.verdiBoms == verdi);
        if (antall >= 4 && kb.verdiBoms == verdi) {
            info.tekst = `Fire ${Kort.VerdiNavn(kb[0].verdi).navnflertall}`;
            return true;
        }
        if (this.spillere.filter(spiller => (spiller.laPaaSist != "Pass" && spiller.plassering == 0)).length <= 1) {
            info.tekst = "Alle spillere sa pass";
            return true;
        }
        return false;
    }
    LeggKort(spiller, kb) {
        if (!this.KanLeggeKortBunke(spiller, kb)) { throw ("Kan ikke legge dette nÃ¥!"); };
        if (this.spillBunke.length == 0) {
            this.spillere.filter(s => (s.plassering > 0 && s.melding.length > 0)).forEach(s => {
                s.melding = [];
            });
        }
        kb.forEach(leggKort => {
            var i = spiller.kort.findIndex(k => (k == leggKort));
            spiller.kort.splice(i, 1);
        });
        spiller.laPaaSist = kb;
        this.spillBunke.push(kb);
        if (spiller.kort.length == 0) {
            if (kb.verdiBoms == KortBoms.Klover3verdi()) {
                // Hvis man legger KlÃ¸ver 3 som siste kort, sÃ¥ taper man:
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
            var spillerSist = this.spillere[varSinTur];
            //if (typeof spillerSist.laPaaSist == "KortBunke") {
            if (spillerSist.laPaaSist) {
                spillerSist.melding.push(`${((spillerSist.laPaaSist.Tekst) ? "La pÃ¥ " + spillerSist.laPaaSist.Tekst() : spillerSist.laPaaSist)}, bunken gÃ¥r ut. (${info.tekst})`);
            } else {
                spillerSist.melding.push(`Bunken gikk ut og ferdig. (${info.tekst})`);
            }
            this.runde++;
            this.spillere.forEach(spiller => {
                spiller.laPaaSist = null;
            });
            //Finn den som la pÃ¥ sist, og som har kort igjen pÃ¥ hÃ¥nden.
            var nesteNick = null;
            this.spillBunke.forEach(kb => {
                if (this.getSpiller(kb.nick).kort.length > 0) {
                    nesteNick = kb.nick;
                }
            });
            if (nesteNick == null) {
                //Hvis ingen av de som la pÃ¥ i runden har kort igjen, sÃ¥ gÃ¥r vi baklengs for Ã¥ finne neste som legger pÃ¥.
                nesteNick = this.OversteKortBunke().nick;
                var huskIndex = this.spillere.findIndex(spiller => (spiller.nick == nesteNick));
                do {
                    huskIndex--;
                    if (huskIndex < 0) { huskIndex += this.spillere.length; };
                } while (this.spillere[huskIndex].plassering > 0);
                this.spillBunke = [];
                return huskIndex;
            }
            this.spillBunke = [];
            return this.spillere.findIndex(spiller => (spiller.nick == nesteNick));
        } else {
            return varSinTur + 1;
        }
    }
    NesteSinTur_HoppOver(sinTur) {
        return (this.spillere[sinTur].laPaaSist == "Pass");
    }
}