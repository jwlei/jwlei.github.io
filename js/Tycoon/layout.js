class Layout {
    static el(tittel) {
        return document.getElementById(tittel);
    }
    static elVisible(elem, synlig = true) {
        if (typeof (elem) == "string") {
            elem = this.el(elem);
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
                throw ("Ukjent argument.");
                break;
        }
        try {
            var elem_off;
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
        if (width != null) { e.width = width; };
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
                // Knapp for Ã¥ fjerne spiller (vises ikke nÃ¥r man spiller)
                var elemFjern = document.createElement("button");
                elemFjern.innerHTML = "Fjern";
                elemFjern.onclick = function () {
                    spill.AvsluttSpiller(spiller);
                };
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
                    placeholder.id = "SpanHoppover";
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
        tekster.push("Avbryt (ikke gjÃ¸r noe)");
        funcer.push(function () { });
        var elem = document.getElementById("SpanHoppover");
        if (elem == null) { return; };
        fixClass(elem, "DropdownButton", true);
        var b = document.createElement("img");
        b.src = 'ikoner/00Sleep.png';
        b.alt = 'Hjelp spiller som har sovnet';
        b.onclick = function () {
            dialogAskStart(
                "Spilleren har ikke gjort noe pÃ¥ en stund. Vil du overstyre spilleren?",
                tekster,
                funcer
            );
        };
        elem.appendChild(b);
    }
    static FixBord(spill, spiller) {
        var bord = document.getElementById("DivBord");
        switch (spill.status) {
            case "O":
                if (spill.spillere.length == 0) {
                    // Vis tips nÃ¥r det er oppstart og ingen spillere.
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
                    if (!bytte.kort) { bytte.kort = []; };
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
                    //        ((bytte.modus == "Best") ? `${spill.spillere[bytte.fra].nick} mÃ¥ gi ${bytte.antall} beste-kort:` :
                    //            ((bytte.modus == "Gitt") ? `${spill.spillere[bytte.fra].nick} har bestemt seg:` :
                    //                ((bytte.modus == "Kan se") ? `${spill.spillere[bytte.til].nick} fÃ¥r kort:` :
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
                        };
                        spanKnapp.appendChild(elemKnapp);
                    }
                    if (spill.spillere[bytte.til] == spiller && bytte.modus == "Kan se") {
                        var elemKnapp = document.createElement("button");
                        //elemKnapp.innerHTML = "<img src='ikoner/00Done.png' alt='Motta kort' /></img>";
                        elemKnapp.innerHTML = `Motta fra ${spill.spillere[bytte.fra].nick}`;
                        elemKnapp.onclick = function () {
                            spill.BytteKort_FaaKort(bytte);
                        };
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
                });
                break;
            case "S":
                bord.className = "BordKortstokk";
                bord.innerHTML = "";
                const sv = "H" + game.spillId + game.ts + game.runde;
                var seedRandom = new Math.seedrandom(sv);
                var elem = null;
                spill.spillBunke.forEach(kb => {
                    kb.forEach(k => {
                        elem = Layout.imgKortElem(k, null);
                        elem.style = `transform: translateX(${Math.round(seedRandom() * 50 - 25)}px) translateY(${Math.round(seedRandom() * 80 - 40)}px) rotate(${Math.round(seedRandom() * 30 - 15)}deg);`;
                        bord.appendChild(elem);
                    });
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
                            this.el("SpanSpillerInfo").innerHTML = `Du skal starte Ã¥ legge ut.`;
                        } else {
                            this.el("SpanSpillerInfo").innerHTML = `Spilleren fÃ¸r deg la ${o.Tekst()}.`;
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
                                    var i = gave.kort.findIndex(kort => (kort.farge == k.farge && kort.verdi == k.verdi));
                                    if (i >= 0) {
                                        gave.kort.splice(i, 1);
                                        spill.Lagre();
                                    } else {
                                        gave.kort.push(k);
                                        spill.Lagre();
                                    };
                                };
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
                                                for (let n = 0; n < i; n++) { kb.push(info.kb[n]); };
                                                var htmlTekst = "<div class='AskKort'>";
                                                kb.forEach(kort => {
                                                    htmlTekst += Layout.imgKortTag(kort, null);
                                                });
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
                                            });
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
                            };
                            break;
                        default:
                            break;
                    }
                    elem.appendChild(elemKort);
                });
            }
        } else {
            fixClass(elem, "KortKort", true);
            fixClass(elem, "KortForklaring", false);
            var s = `<img src='ikoner/${spill.spillerTittel(spiller.plassering).img}' alt='Ferdig' height='90%' />`;
            if (spill.status == "S") {
                s += `<span>Du ble <b>${spill.spillerTittel(spiller.plassering).tittel}</b>. Venter pÃ¥ at de andre skal spille ferdig.</span>`;
            } else {
                s += `<span>Spillet er ferdig. Du ble <b>${spill.spillerTittel(spiller.plassering).tittel}</b> (av ${spill.spillere.length} spillere). For Ã¥ spille en runde til, trykk pÃ¥ <img src="ikoner/00Start.png" style="height: 1em; vertical-align: text-bottom;" alt="startknappen" />.</span>`;
            }
            elem.innerHTML = s;
        }
    }
}