class Layout {
    static el(title) {
        return document.getElementById(title);
    }

    static elVisible(elem, visible = true) {
        if (typeof (elem) == "string") {
            elem = this.el(elem);
        }
        switch (visible) {
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
                throw ("Invalid argument.");
                break;
        }
        try {
            var elementOff;
            elementOff = this.el(elem.id + "_Off");
            elementOff.style.display = ((elem.style.display == "none") ? "inline" : "none");
        } catch (error) { }
    }

    static imageCardTag(card, width = null, rotation = null) {
        return `<img
                    src='${card.Img()}' ${((width != null) ? "width='" + width + "'" : "")}
                    alt='${card.Navn()}' ${((rotation != null) ? "transform: translateX(" + rotation + "px) rotate(" + rotation + "deg);" : "")} />`;
    }

    static imageCardElement(card, width) {
        let e = document.createElement("img");
        e.src = card.Img();
        if (width != null) { e.width = width; };
        e.alt = card.Navn();
        return e;
    }

    static mainMenuController(game, player) {
        let divMainMenu = document.getElementById("DivHovedmeny");

        if (game == null) {
            fixClass(divMainMenu, "Skjul", false);
            this.drawCreateConnect();
            document.getElementById("DivBord").innerHTML = "";
        } else {
            fixClass(divMainMenu, "Skjul", true);
            this.buttonController(game);
            this.playerActionsController(game, player);
            this.FixBord(game, player);
        }
    }

    static drawCreateConnect() {
        this.elVisible("BnHNySpill", true);
        this.elVisible("BnHKobleSpill", true);
    }

    static buttonController(game) {
        this.el("SpanSpillId").innerHTML = game.gameId;
        switch (game.status) {
            case "O":
                this.elVisible("BnFInviterSpill", true);
                this.elVisible("BnFNyAutoSpiller", true);
                this.elVisible("BnFStartSpill", game.players.length >= 2);
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
                throw ('Unknown gamestate.');
                break;
        }
    }

    static playerActionsController(game, playerMe) {
        let elementPlayers = document.getElementById("DivSpillere");
        elementPlayers.innerHTML = "";

        game.players.forEach(player => {
            let elementPlayer = document.createElement("div");
            let elementNickname = document.createElement("span");
            elementNickname.innerHTML = player.nickname;
            elementPlayer.appendChild(elementNickname);

            if (game.status != "S" && game.status != "G") {
                let elementRemovePlayer = document.createElement("button");  // Remove player button
                elementRemovePlayer.innerHTML = "Fjern";
                elementRemovePlayer.onclick = function () {
                    game.terminatePlayer(player);
                };
                elementPlayer.appendChild(elementRemovePlayer);
            }

            if (player.placement == 0) {
                // Oppsett og game
                if (player.playedLastCards) {
                    if (player.playedLastCards == "Pass") {
                        let imgPass = document.createElement("img");
                        imgPass.src = "ikoner/00Pass.png"; // TODO: Remove image
                        elementPlayer.appendChild(imgPass);
                    } else {
                        let i = 0;
                        while (player.playedLastCards[i]) {
                            elementPlayer.appendChild(Layout.imageCardElement(player.playedLastCards[i], null));
                            i++;
                        }
                    }
                } else if (player.hasTurn == 1) {
                    let placeholder = document.createElement("span");
                    placeholder.id = "SpanHoppover";
                    elementPlayer.appendChild(placeholder);
                    setTimerHoppover(game);
                }
                elementPlayer.className =
                    ((player.hasTurn == 1) ? " MinTur" : "") +
                    ((player.card.length == 1) ? " EttKort" : "");
                let elementCardBackground = document.createElement("div");
                elementCardBackground.className = "SpillerKortBakgrunner";
                for (let cardNum = player.card.length; cardNum > 0; cardNum--) {
                    if (cardNum <= player.antTrukket) {
                        elementCardBackground.appendChild(Layout.imageCardElement(KortBoms.BakgrunnKort(1), null));
                    } else {
                        elementCardBackground.appendChild(Layout.imageCardElement(KortBoms.BakgrunnKort(), null));
                    }
                }
                player.card.forEach(card => { });
                elementPlayer.appendChild(elementCardBackground);
            } else {
                // Ferdig
                elementPlayer.className = "Ferdig";
                let elemPlass = document.createElement("div");
                elemPlass.className = "SpillerKortPlassering";
                let title = game.spillerTittel(player.plassering);
                elemPlass.innerHTML = `<img src='ikoner/${title.img}' alt='${title.title}' />` + `&nbsp;${title.title}`;
                elementPlayer.appendChild(elemPlass);
            }
            player.message.forEach(m => {
                let elementMessage = document.createElement("span");
                elementMessage.className = "melding";
                elementMessage.innerHTML = m;
                elementPlayer.appendChild(elementMessage);
                elementPlayer.appendChild(document.createElement("br"));
            });
            elementPlayers.appendChild(elementPlayer);
        });
    }

    static TegneHoppover(tekster, funcer) {
        tekster.push("Avbryt (ikke gjÃ¸r noe)");
        funcer.push(function () { });
        let elem = document.getElementById("SpanHoppover");
        if (elem == null) { return; };
        fixClass(elem, "DropdownButton", true);
        let b = document.createElement("img");
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
        let bord = document.getElementById("DivBord");
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
                        s += Layout.imageCardTag(Kort.BakgrunnKort(), null);
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
                        var elemK = Layout.imageCardElement(((seKort) ? new Kort(kort.farge, kort.verdi) : Kort.BakgrunnKort()), null);
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
                        elem = Layout.imageCardElement(k, null);
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
                    elemKort.innerHTML = Layout.imageCardTag(k, null);
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
                                                    htmlTekst += Layout.imageCardTag(kort, null);
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
                                                htmlTekst += Layout.imageCardTag(kort, null);
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