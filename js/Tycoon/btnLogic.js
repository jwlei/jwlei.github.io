(
    function () {
        var rememberGame = null;
        var rememberNickname = null;

        document.getElementById('BnHNySpill').addEventListener('click', function () {
            if (navigator.userAgent.match(/Android|iPhone/i)) {
                try {
                    openFullscreen(document.getElementsByTagName("body")[0]);
                } catch (error) { }
            }
            rememberGame = new SpillBoms();
            rememberNickname = null;
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
            rememberGame = new SpillBoms(Id);
            rememberNickname = null;
            KobleSpill(function () {
                if (rememberGame == null) {
                    document.getElementById('dialogKobleSpillError').innerHTML = "Kunne ikke koble til. Er spill-nummeret riktig?";
                    document.getElementById('dialogKobleSpillId').focus();
                } else {
                    showDialog("KobleSpill", false);
                }
            });
        });

        function KobleSpill(funksjonEtterKobling = function () { }) {
            rememberGame.databaseRef.on('value', function (snapshot) {
                var ny = snapshot.val();
                if (ny != null) {
                    if (ny.spillere == null) { ny.spillere = [] }
                    if (ny.spillBunke == null) { ny.spillBunke = [] }
                    rememberGame.status = ny.status;
                    rememberGame.regler = ny.regler;
                    rememberGame.runde = ny.runde;
                    rememberGame.spillere = TycoonPlayer.setPlayers(ny.spillere);
                    rememberGame.spillBunke = ((rememberGame.status == "G") ? ny.spillBunke : KortBoms.KortstokkBunkeKode_set(ny.spillBunke));
                    rememberGame.sinTur = ny.sinTur;
                    rememberGame.ts = ny.ts;
                    Layout.FixFelles(rememberGame, rememberGame.getSpiller(rememberNickname));
                    Layout.FixPrivat(rememberGame, rememberGame.getSpiller(rememberNickname));
                } else {
                    rememberGame = null;
                    rememberNickname = null;
                    Layout.FixFelles(null, null);
                    Layout.FixPrivat(null, null);
                }
                funksjonEtterKobling();
            });
        }

        document.getElementById('BnFInviterSpill').addEventListener('click', function () {
            if (rememberGame == null) { throw ('MÃ¥ lage spill fÃ¸r du inviterer.') }
            s = `${document.baseURI}?spillid=${rememberGame.spillId}`;
            dialogVisLinkStart(rememberGame.spillId, s);
        });

        document.getElementById('BnFStartSpill').addEventListener('click', function () {
            rememberGame.StartSpill();
            setTimeout(checkPlayer_comIsPlaying, 1500);
        });

        document.getElementById('BnFHovedmeny').addEventListener('click', function () {
            if (rememberGame != null) {
                if (rememberNickname == null || rememberGame.status == "F") {
                    rememberGame = null;
                    try {
                        closeFullscreen();
                    } catch (error) { }
                    Layout.FixFelles(null, null);
                } else {
                    dialogAskStart(
                        "Vil du avslutte spillet?", [
                        "Ja, gÃ¥ til hovedmenyen",
                        "Nei, fortsett spillet"
                    ], [
                        function () {
                            rememberGame.AvsluttSpiller(rememberGame.getSpiller(rememberNickname));
                            rememberNickname = null;
                            rememberGame = null;
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
            if (rememberNickname != null) { throw ('Skal ikke lage ny spiller nÃ¥r man allerede har en spiller.') }
            showDialog("SporOmNick", true);
        });

        document.getElementById('dialogSporOmNickOk').addEventListener('click', function () {
            var onskeNick = document.getElementById('dialogSporOmNickTxt').value.replace("'", "").replace('"', '').replace("<", "").replace(">", "").trim(" ");
            if (onskeNick != "") {
                var key = getSpillerKey();
                var nyspiller = rememberGame.NySpiller(new TycoonPlayer(onskeNick, key));
                if (nyspiller.spiller) {
                    rememberNickname = nyspiller.spiller.nick;
                    Layout.FixPrivat(rememberGame, nyspiller.spiller);
                    showDialog("SporOmNick", false);
                } else {
                    document.getElementById('dialogSporOmNickError').innerHTML = nyspiller.tekst;
                }
            }
        });

        document.getElementById('BnPGiOpp').addEventListener('click', function () {
            if (rememberGame.status == "S") {
                dialogAskStart(
                    "Er du sikker pÃ¥ at du vil gi opp?", [
                    "Ja, jeg vil avslutte spillet",
                    "Nei, jeg fortsetter spillet"
                ], [
                    function () {
                        var spiller = rememberGame.AvsluttSpiller(rememberGame.getSpiller(rememberNickname));
                        if (spiller == null) { rememberNickname = null; }
                    },
                    function () { }
                ]
                );
            } else {
                var spiller = rememberGame.AvsluttSpiller(rememberGame.getSpiller(rememberNickname));
                if (spiller == null) { rememberNickname = null; }
            }
        });

        document.getElementById('BnFNyAutoSpiller').addEventListener('click', function () {
            const key = "PC";
            var alternativer = ["PC A", "PC B", "PC C", "PC D", "PC E"];
            rememberGame.spillere.forEach(spiller => {
                alternativer = alternativer.filter(nick => (nick != spiller.nick));
            });
            if (alternativer.length > 0) {
                rememberGame.NySpiller(new TycoonPlayer(alternativer[0], key));
            } else {
                //navigator.alert("Kan ikke legge til flere autospillere.");
            }
        })

        document.getElementById('BnPPass').addEventListener('click', function () {
            rememberGame.SpillerPass(rememberGame.getSpiller(rememberNickname));
        });

        //Layout.FixFelles(rememberGame, rememberGame.getPlayer(rememberNickname));
        //Layout.FixPrivat(rememberGame, rememberGame.getPlayer(rememberNickname));

        document.getElementById('BnFResultater').addEventListener('click', function () {
            if (!rememberGame.resultater) { rememberGame.resultater = []; };
            dialogResultaterStart(rememberGame.resultater);
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
            if (rememberGame && rememberGame.runde > 0) {
                document.getElementById("SpanSpillStat").innerHTML =
                    `Runde ${rememberGame.runde} - ${FormatMin(rememberGame.SpillTid())}`;
            } else {
                document.getElementById("SpanSpillStat").innerHTML = "";
            }
        }, 1000);
    }
)();