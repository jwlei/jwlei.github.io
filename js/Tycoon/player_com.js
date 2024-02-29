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