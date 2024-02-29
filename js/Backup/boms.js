class Layout {
    static el(tittel) {
        return document.getElementById(tittel);
    }
    static elVisible(elem, synlig = true) {
        if (typeof (elem) == "string") {
            elem = this.el(elem)
        }
        switch (synlig) {
            case true:
                elem.style.display = "inline";
                break;
            case false:
                elem.style.display = "none";
                break;
            case null:
                elem.style.display = ((elem.style.display == "none") ? "inline" : "none");
                break;
            default:
                throw ("Ukjent argument.")
                break;
        }
        try {
            var elem_off
            elem_off = this.el(elem.id + "_Off");
            elem_off.style.display = ((elem.style.display == "none") ? "inline" : "none");
        } catch (error) { }
    }
    static imgKortTag(K, width = null, rotering = null) {
        return `<img src='${K.Img()}' ${((width != null) ? "width='" + width + "'" : "")} alt='${K.Navn()}' ${((rotering != null) ? "transform: translateX(" + rotering + "px) rotate(" + rotering + "deg);" : "")} />`;
    }
    static imgKortElem(K, width) {
        var e = document.createElement("img");
        e.src = K.Img();
        if (width != null) { e.width = width };
        e.alt = K.Navn();
        return e;
    }
    static FixFelles(spill, spiller) {
        var divHovedmeny = document.getElementById("DivHovedmeny");
        if (spill == null) {
            fixClass(divHovedmeny, "Skjul", false);
            this.FixHovedmeny();
            document.getElementById("DivBord").innerHTML = "";
        } else {
            fixClass(divHovedmeny, "Skjul", true);
            this.FixFKnapper(spill);
            this.FixSpillere(spill, spiller);
            this.FixBord(spill, spiller);
        }
    }
    static FixHovedmeny() {
        this.elVisible("BnHNySpill", true);
        this.elVisible("BnHKobleSpill", true);
    }
    static FixFKnapper(spill) {
        this.el("SpanSpillId").innerHTML = spill.spillId;
        switch (spill.status) {
            case "O":
                this.elVisible("BnFInviterSpill", true);
                this.elVisible("BnFNyAutoSpiller", true);
                this.elVisible("BnFStartSpill", spill.spillere.length >= 2);
                this.elVisible("BnFRegler", true);
                this.elVisible("BnFHovedmeny", true);
                break;
            case "S":
            case "G":
                this.elVisible("BnFInviterSpill", true);
                this.elVisible("BnFNyAutoSpiller", false);
                this.elVisible("BnFStartSpill", false);
                this.elVisible("BnFRegler", true);
                this.elVisible("BnFHovedmeny", false);
                break;
            case "F":
                this.elVisible("BnFInviterSpill", true);
                this.elVisible("BnFNyAutoSpiller", true);
                this.elVisible("BnFStartSpill", true);
                this.elVisible("BnFRegler", true);
                this.elVisible("BnFHovedmeny", true);
                break;
            default:
                throw ('Ukjent spillstatus.');
                break;
        }
    }
    static FixSpillere(spill, spillerErJeg) {
        var elemHele = document.getElementById("DivSpillere");
        elemHele.innerHTML = "";
        spill.spillere.forEach(spiller => {
            var elemSpiller = document.createElement("div");
            var elemNick = document.createElement("span");
            elemNick.innerHTML = spiller.nick;
            elemSpiller.appendChild(elemNick);
            if (spill.status != "S" && spill.status != "G") {
                // Knapp for å fjerne spiller (vises ikke når man spiller)
                var elemFjern = document.createElement("button");
                elemFjern.innerHTML = "Fjern";
                elemFjern.onclick = function () {
                    spill.AvsluttSpiller(spiller);
                }
                elemSpiller.appendChild(elemFjern);
            }
            if (spiller.plassering == 0) {
                // Oppsett og spill
                if (spiller.laPaaSist) {
                    if (spiller.laPaaSist == "Pass") {
                        var imgPass = document.createElement("img");
                        imgPass.src = "ikoner/00Pass.png";
                        elemSpiller.appendChild(imgPass);
                    } else {
                        var i = 0;
                        while (spiller.laPaaSist[i]) {
                            elemSpiller.appendChild(Layout.imgKortElem(spiller.laPaaSist[i], null));
                            i++;
                        }
                    }
                } else if (spiller.sinTur == 1) {
                    var placeholder = document.createElement("span");
                    placeholder.id = "SpanHoppover"
                    elemSpiller.appendChild(placeholder);
                    setTimerHoppover(spill);
                }
                elemSpiller.className =
                    ((spiller.sinTur == 1) ? " MinTur" : "") +
                    ((spiller.kort.length == 1) ? " EttKort" : "");
                var elemKortbakgrunner = document.createElement("div");
                elemKortbakgrunner.className = "SpillerKortBakgrunner";
                for (let kortNr = spiller.kort.length; kortNr > 0; kortNr--) {
                    if (kortNr <= spiller.antTrukket) {
                        elemKortbakgrunner.appendChild(Layout.imgKortElem(KortBoms.BakgrunnKort(1), null));
                    } else {
                        elemKortbakgrunner.appendChild(Layout.imgKortElem(KortBoms.BakgrunnKort(), null));
                    }
                }
                spiller.kort.forEach(k => { });
                elemSpiller.appendChild(elemKortbakgrunner);
            } else {
                // Ferdig
                elemSpiller.className = "Ferdig";
                var elemPlass = document.createElement("div");
                elemPlass.className = "SpillerKortPlassering";
                var tittel = spill.spillerTittel(spiller.plassering);
                elemPlass.innerHTML = `<img src='ikoner/${tittel.img}' alt='${tittel.tittel}' />` + `&nbsp;${tittel.tittel}`;
                elemSpiller.appendChild(elemPlass);
            }
            spiller.melding.forEach(m => {
                var elemMelding = document.createElement("span");
                elemMelding.className = "melding";
                elemMelding.innerHTML = m;
                elemSpiller.appendChild(elemMelding);
                elemSpiller.appendChild(document.createElement("br"));
            });
            elemHele.appendChild(elemSpiller);
        });
    }
    static TegneHoppover(tekster, funcer) {
        tekster.push("Avbryt (ikke gjør noe)");
        funcer.push(function () { });
        var elem = document.getElementById("SpanHoppover");
        if (elem == null) { return; };
        fixClass(elem, "DropdownButton", true);
        var b = document.createElement("img");
        b.src = 'ikoner/00Sleep.png';
        b.alt = 'Hjelp spiller som har sovnet';
        b.onclick = function () {
            dialogAskStart(
                "Spilleren har ikke gjort noe på en stund. Vil du overstyre spilleren?",
                tekster,
                funcer
            )
        };
        elem.appendChild(b);
    }
    static FixBord(spill, spiller) {
        var bord = document.getElementById("DivBord");
        switch (spill.status) {
            case "O":
                if (spill.spillere.length == 0) {
                    // Vis tips når det er oppstart og ingen spillere.
                    bord.className = "BordForklaring";
                    bord.innerHTML = document.getElementById("DivBord_Bordforklaring").innerHTML;
                } else {
                    // Hvis det er oppstart og spillere, vises kortstokken.
                    bord.className = "BordKortstokker";
                    var s = "";
                    for (let i = 0; i < spill.BeregnAntKortstokker(); i++) {
                        s += Layout.imgKortTag(Kort.BakgrunnKort(), null);
                    }
                    bord.innerHTML = s;
                }
                break;
            case "G":
                bord.className = "BordBytte";
                bord.innerHTML = "";
                spill.spillBunke.forEach(bytte => {
                    if (!bytte.kort) { bytte.kort = [] };
                    var seKort = (
                        (spill.spillere[bytte.fra] == spiller && (bytte.modus == "Velg" || bytte.modus == "Best")) ||
                        (spill.spillere[bytte.til] == spiller && bytte.modus == "Kan se")
                    );
                    var elem = document.createElement("div");
                    elem.className = "bytte";
                    if (seKort) {
                        fixClass(elem, "aktivbytte");
                    } else {
                        fixClass(elem, "passivbytte");
                    }
                    //elem.innerHTML =
                    //    `<img src="ikoner/${spill.spillerTittel(bytte.fra+1).img}" alt="${spill.spillerTittel(bytte.fra+1).img}" />` +
                    //    `&gt;` +
                    //    `<img src="ikoner/${spill.spillerTittel(bytte.til+1).img}" alt="${spill.spillerTittel(bytte.til+1).img}" />` +
                    //    ((bytte.modus == "Velg") ? `${spill.spillere[bytte.fra].nick} skal gi ${bytte.antall} kort:` :
                    //        ((bytte.modus == "Best") ? `${spill.spillere[bytte.fra].nick} må gi ${bytte.antall} beste-kort:` :
                    //            ((bytte.modus == "Gitt") ? `${spill.spillere[bytte.fra].nick} har bestemt seg:` :
                    //                ((bytte.modus == "Kan se") ? `${spill.spillere[bytte.til].nick} får kort:` :
                    //                    `Hmmm... ${bytte.modus}`))));
                    elem.innerHTML = `<div class="bytteFigur"><img src="ikoner/${spill.spillerTittel(bytte.fra + 1).img}" alt="${spill.spillerTittel(bytte.fra + 1).tittel}" /></div>`;
                    elem.innerHTML += `<div class="bytteTittel">${bytte.tekst}</div>`;
                    var elemDiv = document.createElement("div");
                    elemDiv.className = "bytteKort";
                    //if (bytte.kort.length == 0 && seKort) {
                    //    elemDiv.innerHTML = `Du skal gi ${bytte.antall} kort. Velg fra kortstokken din.`;
                    //}
                    var spanKort = document.createElement("span");
                    bytte.kort.forEach(kort => {
                        var elemK = Layout.imgKortElem(((seKort) ? new Kort(kort.farge, kort.verdi) : Kort.BakgrunnKort()), null);
                        spanKort.appendChild(elemK);
                    });
                    var spanKnapp = document.createElement("span");
                    if (spill.spillere[bytte.fra] == spiller && bytte.antall == bytte.kort.length && (bytte.modus == "Velg" || bytte.modus == "Best")) {
                        var elemKnapp = document.createElement("button");
                        //elemKnapp.innerHTML = "<img src='ikoner/00Done.png' alt='Gi kort' />";
                        elemKnapp.innerHTML = `Gi til ${spill.spillere[bytte.til].nick}`;
                        elemKnapp.onclick = function () {
                            spill.BytteKort_GiKort(bytte);
                        }
                        spanKnapp.appendChild(elemKnapp);
                    }
                    if (spill.spillere[bytte.til] == spiller && bytte.modus == "Kan se") {
                        var elemKnapp = document.createElement("button");
                        //elemKnapp.innerHTML = "<img src='ikoner/00Done.png' alt='Motta kort' /></img>";
                        elemKnapp.innerHTML = `Motta fra ${spill.spillere[bytte.fra].nick}`;
                        elemKnapp.onclick = function () {
                            spill.BytteKort_FaaKort(bytte);
                        }
                        spanKnapp.appendChild(elemKnapp);
                    }
                    switch (bytte.modus) {
                        case "Velg":
                        case "Best":
                            elemDiv.appendChild(spanKort);
                            elemDiv.appendChild(spanKnapp);
                            elemDiv.style.textAlign = "left";
                            break;
                        case "Gitt":
                            elemDiv.appendChild(spanKort);
                            elemDiv.style.textAlign = "center";
                            break;
                        case "Kan se":
                            elemDiv.appendChild(spanKnapp);
                            elemDiv.appendChild(spanKort);
                            elemDiv.style.textAlign = "right";
                            break;
                        default:
                            break;
                    }
                    elem.appendChild(elemDiv);
                    bord.appendChild(elem);
                })
                break;
            case "S":
                bord.className = "BordKortstokk";
                bord.innerHTML = "";
                const sv = "H" + Spill.spillId + Spill.ts + Spill.runde;
                var seedRandom = new Math.seedrandom(sv);
                var elem = null;
                spill.spillBunke.forEach(kb => {
                    kb.forEach(k => {
                        elem = Layout.imgKortElem(k, null);
                        elem.style = `transform: translateX(${Math.round(seedRandom() * 50 - 25)}px) translateY(${Math.round(seedRandom() * 80 - 40)}px) rotate(${Math.round(seedRandom() * 30 - 15)}deg);`;
                        bord.appendChild(elem);
                    })
                });
                break;
            case "F":
                bord.className = "BordForklaring";
                bord.innerHTML = "";
                var elem = document.createElement("div");
                elem.className = "tips";
                elem.innerHTML = `<div><img src="ikoner/00President.png" alt='President' /><b>${spill.spillere[0].nick}</b> ble President.</div>`;
                bord.appendChild(elem);
                break;
            default:
                throw ("Ukent status.");
                break;
        }
    }
    static FixPrivat(spill, spiller) {
        fixClass(document.getElementById("DivHele"), "SePaaModus", (spiller == null));
        fixClass(document.getElementById("DivHele"), "KunKortModus", (spill != null && spill.regler.VisKunKort && spiller != null));
        this.FixPKnapper(spill, spiller);
        this.FixKort(spill, spiller);
    }
    static FixPKnapper(spill, spiller) {
        if (spill == null) {
            this.elVisible("BnPNySpiller", false);
            this.elVisible("BnPPass", false);
            this.elVisible("BnPGiOpp", false);
            return;
        }
        if (spiller == null) {
            this.el("SpanSpillerNick").innerHTML = "";
            this.el("SpanSpillerInfo").innerHTML = "";
        } else {
            this.el("SpanSpillerNick").innerHTML = spiller.nick;
            if (spiller.sinTur == 1) {
                switch (spill.status) {
                    case "G":
                        this.el("SpanSpillerInfo").innerHTML = `Du skal gi kort.`;
                        break;
                    case "S":
                        var o = spill.OversteKortBunke();
                        if (o == null) {
                            this.el("SpanSpillerInfo").innerHTML = `Du skal starte å legge ut.`;
                        } else {
                            this.el("SpanSpillerInfo").innerHTML = `Spilleren før deg la ${o.Tekst()}.`;
                        }
                        break;
                    default:
                        this.el("SpanSpillerInfo").innerHTML = ``;
                        break;
                }
            } else {
                this.el("SpanSpillerInfo").innerHTML = "";
            }
        }
        if (fixClass(this.el("DivPKnapper"), "MinTur", (spiller != null && spiller.sinTur))) {
            // Kommer hit hvis det er en endring.
            fixClass(this.el("DivKort"), "MinTur", (spiller != null && spiller.sinTur));
            if (spiller != null && spiller.sinTur) {
                // enable vibration support
                navigator.vibrate = navigator.vibrate || navigator.webkitVibrate || navigator.mozVibrate || navigator.msVibrate;
                if (navigator.vibrate) {
                    navigator.vibrate([200, 100, 200]);
                }
            }
        };
        this.elVisible("BnPNySpiller", (spiller == null));
        this.elVisible("BnPPass", (spiller != null && spill.SpillerKanPasse(spiller)));
        this.elVisible("BnPGiOpp", (spiller != null && !(spill.status == "S" && spiller.plassering != 0)));
    }
    static FixKort(spill, spiller) {
        var elem = document.getElementById("DivKort");
        elem.innerHTML = "";
        if (spiller == null) {
            return;
        }
        if (spiller.plassering == 0) {
            if (spiller.kort.length == 0) {
                fixClass(elem, "KortKort", false);
                fixClass(elem, "KortForklaring", true);
                elem.innerHTML = document.getElementById("DivKort_Kortforklaring").innerHTML;
            } else {
                fixClass(elem, "KortKort", true);
                fixClass(elem, "KortForklaring", false);
                var kortNummer = -1;
                spiller.kort.forEach(k => {
                    kortNummer++;
                    var elemKort = document.createElement('span');
                    elemKort.style.transform = `translateX(${-2 * Math.round(100 * ((kortNummer / (spiller.kort.length - 1)) - 0.5)) / 10}px) rotate(${Math.round(100 * ((kortNummer / (spiller.kort.length - 1)) - 0.5)) / 10}deg)`;
                    elemKort.innerHTML = Layout.imgKortTag(k, null);
                    switch (spill.status) {
                        case "G":
                            spill.spillBunke.filter(gave => (gave.modus == "Velg" && spill.spillere[gave.fra] == spiller)).forEach(gave => {
                                elemKort.onclick = function () {
                                    if (!gave.kort) { gave.kort = []; };
                                    var i = gave.kort.findIndex(kort => (kort.farge == k.farge && kort.verdi == k.verdi))
                                    if (i >= 0) {
                                        gave.kort.splice(i, 1);
                                        spill.Lagre();
                                    } else {
                                        gave.kort.push(k);
                                        spill.Lagre();
                                    };
                                }
                            });
                            break;
                        case "S":
                            elemKort.onclick = function () {
                                if (spiller.sinTur == 1) {
                                    if (spill.spillBunke.length == 0) {
                                        var dialogTekster = [];
                                        var dialogFuncer = [];
                                        var info = {};
                                        if (spill.KanLeggeKort(spiller, k.verdiBoms, info)) {
                                            for (let i = 1; i <= info.kb.length; i++) {
                                                var kb = new KortBunke(spiller.nick);
                                                for (let n = 0; n < i; n++) { kb.push(info.kb[n]) };
                                                var htmlTekst = "<div class='AskKort'>";
                                                kb.forEach(kort => {
                                                    htmlTekst += Layout.imgKortTag(kort, null);
                                                })
                                                htmlTekst += '</div>';
                                                dialogTekster.push(htmlTekst);
                                                dialogFuncer.push(function () {
                                                    spill.LeggKort(spiller, kb);
                                                });
                                            }
                                        }
                                        dialogTekster.push("Velg annet kort");
                                        dialogFuncer.push(function () { });
                                        dialogAskStart("Vil du legge:", dialogTekster, dialogFuncer);
                                    } else {
                                        var info = {};
                                        if (spill.KanLeggeKort(spiller, k.verdiBoms, info)) {
                                            var htmlTekst = "<div class='AskKort'>";
                                            info.kb.forEach(kort => {
                                                htmlTekst += Layout.imgKortTag(kort, null);
                                            })
                                            htmlTekst += '</div>';
                                            var dialogTekster = [
                                                //`Legg ${info.kb.Tekst()}`,
                                                htmlTekst,
                                                "Velg annet kort"
                                            ];
                                            var dialogFuncer = [function () {
                                                spill.LeggKort(spiller, info.kb);
                                            },
                                            function () { }
                                            ];
                                            dialogAskStart("Vil du legge:", dialogTekster, dialogFuncer);
                                        } else {
                                            showDialog("KanIkkeLeggeKort", true);
                                        }
                                    }
                                }
                            }
                            break;
                        default:
                            break;
                    }
                    elem.appendChild(elemKort)
                });
            }
        } else {
            fixClass(elem, "KortKort", true);
            fixClass(elem, "KortForklaring", false);
            var s = `<img src='ikoner/${spill.spillerTittel(spiller.plassering).img}' alt='Ferdig' height='90%' />`;
            if (spill.status == "S") {
                s += `<span>Du ble <b>${spill.spillerTittel(spiller.plassering).tittel}</b>. Venter på at de andre skal spille ferdig.</span>`;
            } else {
                s += `<span>Spillet er ferdig. Du ble <b>${spill.spillerTittel(spiller.plassering).tittel}</b> (av ${spill.spillere.length} spillere). For å spille en runde til, trykk på <img src="ikoner/00Start.png" style="height: 1em; vertical-align: text-bottom;" alt="startknappen" />.</span>`;
            }
            elem.innerHTML = s;
        }
    }
}

class KortBoms extends Kort {
    static Klover3verdi() { return 16; }
    static NavnBoms(verdiBoms) {
        return ["", "", "", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A", "2", "Kløver 3"][verdiBoms];
    }
    constructor(farge, verdi) {
        super(farge, verdi);
        if (this.verdi > 3) {
            this.verdiBoms = this.verdi;
        } else if (this.verdi < 3) {
            this.verdiBoms = this.verdi + 13;
        } else {
            // Her er det en 3'er
            if (this.farge == 3) {
                this.verdiBoms = 16; //Kløver 3
            } else {
                this.verdiBoms = 3;
            }
        }
        Object.defineProperty(this, "verdiBoms", { enumerable: false });
    }
    Klover3() {
        return (this.verdiBoms == 16);
    }
    sortFunc(a, b) {
        return (a.verdiBoms - b.verdiBoms) * 10 + (a.farge - b.farge);
    }
    static KortstokkKode_get(kortstokk) {
        var ret = [];
        kortstokk.forEach(kort => {
            ret.push({ farge: kort.farge, verdi: kort.verdi });
        });
        return ret;
    }
    static KortstokkKode_set(verdi) {
        if (verdi == null) { return [] }
        var ret = new Kortstokk();
        verdi.forEach(element => {
            ret.push(new KortBoms(element.farge, element.verdi));
        });
        return ret;
    }
    static KortstokkBunkeKode_get(kortstokk) {
        var ret = [];
        kortstokk.forEach(kb => {
            ret.push(kb);
        });
        return ret;
    }
    static KortstokkBunkeKode_set(verdi) {
        if (verdi == null) { return [] }
        var ret = [];
        verdi.forEach(element => {
            var kb = new KortBunke(element.nick)
            var index = 0;
            while (element[index]) {
                const el = element[index];
                kb.push(new KortBoms(el.farge, el.verdi));
                index++;
            }
            //for (let index = 0; index < element.length; index++) {
            //}
            //element.forEach(k => {
            //    kb.push(new KortBoms(element.farge, element.verdi));
            //})
            ret.push(kb);
        });
        return ret;
    }
}

class KortBunke extends Array {
    constructor(nick, ...korter) {
        super(...korter);
        if (this.length > 0) {
            this.verdiBoms = this[0].verdiBoms;
            this.forEach(k => {
                if (k.verdiBoms != this.verdiBoms) { throw ("Kan ikke legge på forskjellige kort.") }
            });
        } else {
            this.verdiBoms = null;
        }
        this.nick = nick;
    }
    push(item) {
        if (this.verdiBoms != null) {
            if (item.verdiBoms != this.verdiBoms) { throw ("Kan ikke legge på forskjellige kort.") }
        } else {
            this.verdiBoms = item.verdiBoms;
        }
        super.push(item);
    }
    setVerdier(kb) {
        this.nick = kb.nick;
        var i = 0;
        while (kb[i]) {
            var kort = kb[i];
            if (typeof kort != "KortBums") { kort = new KortBoms(kort.farge, kort.verdi); };
            this.push(kort);
            i++;
        };
        return this;
    }
    Tekst() {
        if (this.length == 0) { return "ingen kort" };
        if (this[0].Klover3()) { return "kløver 3" };
        return ["", "en", "to", "tre", "fire", "fem", "seks", "syv"][this.length] + " " + ((this.length > 1) ? Kort.VerdiNavn(this[0].verdi).navnflertall : Kort.VerdiNavn(this[0].verdi).navnentall);
    }
    KanLeggesPa(overst) {
        return (
            (overst == null) || // Første som legges på
            (this.length == overst.length && this.verdiBoms >= overst.verdiBoms) || // Normale regler
            (this.length == 1 && this[0].Klover3()) // Kløver tre
        )
    }
}

class SpillerBoms extends Spiller {
    constructor(nick, spillerKey) {
        super(nick, spillerKey);
        this.tittel = "";
    }
    getVerdier() {
        var ret = super.getVerdier();
        ret.kort = KortBoms.KortstokkKode_get(ret.kort);
        //if (ret.laPaaSist.verdiBoms) { ret.laPaaSist = KortBoms.KortstokkBunkeKode_get(ret.laPaaSist) };
        ret.tittel = this.tittel;
        return ret;
    }
    setVerdier(obj) {
        obj.kort = KortBoms.KortstokkKode_set(obj.kort);
        obj.laPaaSist = ((obj.laPaaSist == null) ? null :
            ((obj.laPaaSist.verdiBoms) ? new KortBunke(obj.laPaaSist.nick).setVerdier(obj.laPaaSist) :
                obj.laPaaSist));
        super.settVerdier(obj);
        this.tittel = obj.tittel;
        return this;
    }
    antallMedVerdiBoms(verdiBoms) {
        return this.kort.filter(k => (k.verdiBoms == verdiBoms)).length;
    }
    nullstillRunde(varSinTur) {
        super.nullstillRunde(varSinTur);
        if (varSinTur === null || (this.laPaaSist != "Pass" && this.plassering == 0)) {
            //Nullstiller bare hvis spilleren fortsatt er med på runden.
            //Nullstiller også hvis det ikke var noen sin tur (nytt spill)
            this.laPaaSist = null;
        }
    }
    static Spillere_get(spillere) {
        var ret = [];
        spillere.forEach(spiller => {
            ret.push(spiller.getVerdier());
        });
        return ret;
    }
    static Spillere_set(verdi) {
        var spillere = [];
        verdi.forEach(element => {
            spillere.push((new SpillerBoms()).setVerdier(element));
        });
        return spillere;
    }
}

class SpillBoms extends Spill {
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
            this.status = 'O'; //O=Oppstart, G=Gir kort S=Spiller, F=Ferdig
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
            kortstokk.LeggTil52Kort(function (farge, verdi) { return new KortBoms(farge, verdi) });
        }
        // Tar ut kort som ikke skal være med
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
            })
        }
        // Fiks rekkefølge og gi kort hvis det har vært et tidligere spill
        if (this.spillere.filter(s => (s.plassering != 0)).length > 0) {
            //Spill i rekkefølge, og bytt kort.
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
                this.spillere[this.spillere.length - 2].melding.push("Gir sitt dårligste kort til visepresidenten.");
                this.spillere[this.spillere.length - 1].melding.push("Gir sine to dårligste kort til presidenten.");
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
                var kort = this.spillere[bytte.fra].kort.filter(k => (!k.Klover3())); //Kløver 3 skal ikke gis.
                for (var i = 1; i <= bytte.antall; i++) {
                    bytte.kort.push(kort[kort.length - i]);
                }
            });
            this.setSinTur(null);
            this.spillBunke.filter(bytte => (bytte.modus == "Velg")).forEach(bytte => {
                this.spillere[bytte.fra].sinTur = 1;
            })
        } else {
            this.spillBunke = [];
            this.spillere.forEach(spiller => {
                spiller.kort.Sorter();
            });
        }
    }
    BytteKort_GiKort(bytte) {
        if (this.status != "G") { throw ("Spillet er ikke i bytte-modus."); };
        if (bytte.modus != 'Velg' && bytte.modus != 'Best') { throw (`Kan ikke gi kort når modus er ${bytte.modus} (må være Velg eller Best).`); };
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
        if (bytte.modus != 'Kan se') { throw (`Kan ikke gi kort når modus er ${bytte.modus} (må være Kan se).`); };
        if (bytte.kort.length != bytte.antall) { throw ("Feil antall kort som byttes."); };
        bytte.kort.forEach(k => {
            this.spillere[bytte.til].kort.push(new KortBoms(k.farge, k.verdi));
        });
        this.spillere[bytte.til].kort.Sorter();
        this.spillBunke.splice(this.spillBunke.findIndex(b => (b == bytte)), 1);
        if (this.spillBunke.length == 0) {
            //Alle bytter gjennomført
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
        // Sjekker både at spilleren har kort som passer og at det kan legges.
        // Kortene merkes og returInfo inneholder kortbunke som kan legges på. (Første runda elle mulige som kan legges på med den verdiBoms.)
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
            })
            returInfo.svar = true;
            returInfo.kb = kb;
            return true;
        };
        var oversteKB = this.OversteKortBunke();
        if (verdiBoms < oversteKB.verdiBoms) {
            returInfo.svar = false;
            returInfo.tekst = `Må legge på ${oversteKB.verdiBoms} eller høyere.`;
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
            returInfo.tekst = `Du må ha ${antallKort} like kort.`;
            return false;
        };
        returInfo.svar = true
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
        if (overst == null) { return false; } //Ingen kort, da går det ikke ut.
        if (overst[0].Klover3()) {
            info.tekst = "Kløver 3";
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
        if (!this.KanLeggeKortBunke(spiller, kb)) { throw ("Kan ikke legge dette nå!"); };
        if (this.spillBunke.length == 0) {
            this.spillere.filter(s => (s.plassering > 0 && s.melding.length > 0)).forEach(s => {
                s.melding = [];
            })
        }
        kb.forEach(leggKort => {
            var i = spiller.kort.findIndex(k => (k == leggKort));
            spiller.kort.splice(i, 1);
        });
        spiller.laPaaSist = kb;
        this.spillBunke.push(kb);
        if (spiller.kort.length == 0) {
            if (kb.verdiBoms == KortBoms.Klover3verdi()) {
                // Hvis man legger Kløver 3 som siste kort, så taper man:
                this.SpillerFerdig(spiller, false);
            } else {
                // Ferdig på riktig måte:
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
                spillerSist.melding.push(`${((spillerSist.laPaaSist.Tekst) ? "La på " + spillerSist.laPaaSist.Tekst() : spillerSist.laPaaSist)}, bunken går ut. (${info.tekst})`);
            } else {
                spillerSist.melding.push(`Bunken gikk ut og ferdig. (${info.tekst})`);
            }
            this.runde++;
            this.spillere.forEach(spiller => {
                spiller.laPaaSist = null;
            });
            //Finn den som la på sist, og som har kort igjen på hånden.
            var nesteNick = null;
            this.spillBunke.forEach(kb => {
                if (this.getSpiller(kb.nick).kort.length > 0) {
                    nesteNick = kb.nick;
                }
            });
            if (nesteNick == null) {
                //Hvis ingen av de som la på i runden har kort igjen, så går vi baklengs for å finne neste som legger på.
                nesteNick = this.OversteKortBunke().nick;
                var huskIndex = this.spillere.findIndex(spiller => (spiller.nick == nesteNick));
                do {
                    huskIndex--;
                    if (huskIndex < 0) { huskIndex += this.spillere.length };
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

(
    function () {
        var HuskSpill = null;
        var HuskNick = null;

        document.getElementById('BnHNySpill').addEventListener('click', function () {
            if (navigator.userAgent.match(/Android|iPhone/i)) {
                try {
                    openFullscreen(document.getElementsByTagName("body")[0]);
                } catch (error) { }
            }
            HuskSpill = new SpillBoms();
            HuskNick = null;
            KobleSpill();
        });

        document.getElementById('BnHKobleSpill').addEventListener('click', function () {
            try {
                openFullscreen(document.getElementsByTagName("body")[0]);
            } catch (error) { }
            document.getElementById("dialogKobleSpillId").value = null;
            document.getElementById('dialogKobleSpillError').innerHTML = "";
            showDialog("KobleSpill", true);
        });

        document.getElementById('dialogKobleSpillOk').addEventListener('click', function () {
            var Id = document.getElementById("dialogKobleSpillId").value;
            HuskSpill = new SpillBoms(Id);
            HuskNick = null;
            KobleSpill(function () {
                if (HuskSpill == null) {
                    document.getElementById('dialogKobleSpillError').innerHTML = "Kunne ikke koble til. Er spill-nummeret riktig?";
                    document.getElementById('dialogKobleSpillId').focus();
                } else {
                    showDialog("KobleSpill", false);
                }
            });
        });

        function KobleSpill(funksjonEtterKobling = function () { }) {
            HuskSpill.databaseRef.on('value', function (snapshot) {
                var ny = snapshot.val();
                if (ny != null) {
                    if (ny.spillere == null) { ny.spillere = [] }
                    if (ny.spillBunke == null) { ny.spillBunke = [] }
                    HuskSpill.status = ny.status;
                    HuskSpill.regler = ny.regler;
                    HuskSpill.runde = ny.runde;
                    HuskSpill.spillere = SpillerBoms.Spillere_set(ny.spillere);
                    HuskSpill.spillBunke = ((HuskSpill.status == "G") ? ny.spillBunke : KortBoms.KortstokkBunkeKode_set(ny.spillBunke));
                    HuskSpill.sinTur = ny.sinTur;
                    HuskSpill.ts = ny.ts;
                    Layout.FixFelles(HuskSpill, HuskSpill.getSpiller(HuskNick));
                    Layout.FixPrivat(HuskSpill, HuskSpill.getSpiller(HuskNick));
                } else {
                    HuskSpill = null;
                    HuskNick = null;
                    Layout.FixFelles(null, null);
                    Layout.FixPrivat(null, null);
                }
                funksjonEtterKobling();
            });
        }

        document.getElementById('BnFInviterSpill').addEventListener('click', function () {
            if (HuskSpill == null) { throw ('Må lage spill før du inviterer.') }
            s = `${document.baseURI}?spillid=${HuskSpill.spillId}`;
            dialogVisLinkStart(HuskSpill.spillId, s);
        });

        document.getElementById('BnFStartSpill').addEventListener('click', function () {
            HuskSpill.StartSpill();
            setTimeout(AutoSpiller, 1500);
        });

        function AutoSpiller() {
            if (HuskSpill.status == "G") {
                HuskSpill.spillere.filter(s => (s.spillerKey == "PC")).forEach(spiller => {
                    AutoSpiller2(HuskSpill, spiller);
                });
            } else if (HuskSpill.status == "S" && HuskSpill.sinTur >= 0 && HuskSpill.spillere[HuskSpill.sinTur].spillerKey == "PC") {
                AutoSpiller2(HuskSpill, HuskSpill.spillere[HuskSpill.sinTur]);
            }
            if (HuskSpill.status != "F") { setTimeout(AutoSpiller, 1500); }
        }

        document.getElementById('BnFHovedmeny').addEventListener('click', function () {
            if (HuskSpill != null) {
                if (HuskNick == null || HuskSpill.status == "F") {
                    HuskSpill = null;
                    try {
                        closeFullscreen();
                    } catch (error) { }
                    Layout.FixFelles(null, null);
                } else {
                    dialogAskStart(
                        "Vil du avslutte spillet?", [
                        "Ja, gå til hovedmenyen",
                        "Nei, fortsett spillet"
                    ], [
                        function () {
                            HuskSpill.AvsluttSpiller(HuskSpill.getSpiller(HuskNick));
                            HuskNick = null;
                            HuskSpill = null;
                            try {
                                closeFullscreen();
                            } catch (error) { }
                            Layout.FixFelles(null, null);
                            Layout.FixPrivat(null, null);
                        },
                        function () { }
                    ]
                    );
                }
            }
        });

        document.getElementById('BnPNySpiller').addEventListener('click', function () {
            if (HuskNick != null) { throw ('Skal ikke lage ny spiller når man allerede har en spiller.') }
            showDialog("SporOmNick", true);
        });

        document.getElementById('dialogSporOmNickOk').addEventListener('click', function () {
            var onskeNick = document.getElementById('dialogSporOmNickTxt').value.replace("'", "").replace('"', '').replace("<", "").replace(">", "").trim(" ");
            if (onskeNick != "") {
                var key = getSpillerKey();
                var nyspiller = HuskSpill.NySpiller(new SpillerBoms(onskeNick, key));
                if (nyspiller.spiller) {
                    HuskNick = nyspiller.spiller.nick;
                    Layout.FixPrivat(HuskSpill, nyspiller.spiller);
                    showDialog("SporOmNick", false);
                } else {
                    document.getElementById('dialogSporOmNickError').innerHTML = nyspiller.tekst;
                }
            }
        });

        document.getElementById('BnPGiOpp').addEventListener('click', function () {
            if (HuskSpill.status == "S") {
                dialogAskStart(
                    "Er du sikker på at du vil gi opp?", [
                    "Ja, jeg vil avslutte spillet",
                    "Nei, jeg fortsetter spillet"
                ], [
                    function () {
                        var spiller = HuskSpill.AvsluttSpiller(HuskSpill.getSpiller(HuskNick));
                        if (spiller == null) { HuskNick = null; }
                    },
                    function () { }
                ]
                );
            } else {
                var spiller = HuskSpill.AvsluttSpiller(HuskSpill.getSpiller(HuskNick));
                if (spiller == null) { HuskNick = null; }
            }
        });

        document.getElementById('BnFNyAutoSpiller').addEventListener('click', function () {
            const key = "PC";
            var alternativer = ["PC A", "PC B", "PC C", "PC D", "PC E"];
            HuskSpill.spillere.forEach(spiller => {
                alternativer = alternativer.filter(nick => (nick != spiller.nick));
            });
            if (alternativer.length > 0) {
                HuskSpill.NySpiller(new SpillerBoms(alternativer[0], key));
            } else {
                //navigator.alert("Kan ikke legge til flere autospillere.");
            }
        })

        document.getElementById('BnPPass').addEventListener('click', function () {
            HuskSpill.SpillerPass(HuskSpill.getSpiller(HuskNick));
        });

        //Layout.FixFelles(HuskSpill, HuskSpill.getSpiller(HuskNick));
        //Layout.FixPrivat(HuskSpill, HuskSpill.getSpiller(HuskNick));

        document.getElementById('BnFResultater').addEventListener('click', function () {
            if (!HuskSpill.resultater) { HuskSpill.resultater = []; };
            dialogResultaterStart(HuskSpill.resultater);
        });

        /*
         *   Dialog Regler
         */

        document.getElementById('BnFRegler').addEventListener('click', function () {
            showDialog("Regler", true);
        });

        setInterval(() => {
            function FormatMin(minutter) {
                const hours = Math.floor(minutter / 60);
                const minutes = minutter % 60;
                return `${hours}:${((minutes < 10) ? "0" : "")}${minutes}`;
            }
            if (HuskSpill && HuskSpill.runde > 0) {
                document.getElementById("SpanSpillStat").innerHTML =
                    `Runde ${HuskSpill.runde} - ${FormatMin(HuskSpill.SpillTid())}`;
            } else {
                document.getElementById("SpanSpillStat").innerHTML = "";
            }
        }, 1000);
    }
)();

function AutoSpiller2(spill, spiller, heleRunden = false) {
    if (spill.status == "G") {
        spill.spillBunke.filter(b => (b.modus == "Kan se" && spill.spillere[b.til] == spiller)).forEach(bytte => {
            spill.BytteKort_FaaKort(bytte);
        });
        spill.spillBunke.filter(b => (b.modus == "Velg" && spill.spillere[b.fra] == spiller)).forEach(bytte => {
            //Finner de dårligste kortene
            for (var i = 1; i <= bytte.antall; i++) {
                bytte.kort.push(spiller.kort[i - 1]);
            }
            //Og gir dem.
            spill.BytteKort_GiKort(bytte);
        });
        spill.spillBunke.filter(b => (b.modus == "Best" && spill.spillere[b.fra] == spiller)).forEach(bytte => {
            spill.BytteKort_GiKort(bytte);
        });
    }
    if (spill.status == "S" && spiller.sinTur == 1 && spiller.plassering == 0) {
        var kb = null;
        if (spill.spillBunke.length == 0) {
            spiller.kort.forEach(kort => {
                kort._Antall = spiller.kort.filter(k => (k.verdiBoms == kort.verdiBoms)).length;
            });
            const valgtVerdiBoms = spiller.kort.sort((a, b) => (b._Antall - a._Antall))[0].verdiBoms;
            kb = new KortBunke(spiller.nick);
            spiller.kort.filter(k => (k.verdiBoms == valgtVerdiBoms)).forEach(kort => {
                kb.push(kort);
            })
        } else {
            spiller.kort.filter(kort => (spill.KanLeggeKort(spiller, kort.verdiBoms))).forEach(kort => {
                if (kb == null || kort.verdiBoms < kb.verdiBoms) {
                    kb = new KortBunke(spiller.nick, kort);
                } else if (kort.verdiBoms == kb.verdiBoms && (kb.length < spill.OversteKortBunke().length)) {
                    kb.push(kort);
                }
            })
        }
        if (kb != null) {
            spill.LeggKort(spiller, kb);
        } else {
            spill.SpillerPass(spiller);
        }
    }
}

var huskTimerHoppover = null;

function setTimerHoppover(spill) {
    if (huskTimerHoppover != null) {
        clearTimeout(huskTimerHoppover);
    }
    huskTimerHoppover = setTimeout(function () {
        var HoppOverSpiller = spill.spillere[spill.sinTur]; //Husker på nummeret slik at det er statisk (i tilfelle flere trykker samtidig).
        Layout.TegneHoppover([
            "Gjør det beste",
            "Hopp over",
            "Si pass",
            "Avslutt spiller"
        ], [function () {
            AutoSpiller2(spill, HoppOverSpiller, true);
        }, function () {
            spill.NesteSinTur();
        }, function () {
            spill.SpillerPass(HoppOverSpiller);
        }, function () {
            spill.AvsluttSpiller(HoppOverSpiller);
        }]);
    }, 20000); //Kommer opp hvis spiller ikke har gjort noe på 20 sekunder.
}