class KortBoms extends Kort {
    static Klover3verdi() { return 16; }
    static NavnBoms(verdiBoms) {
        return ["", "", "", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A", "2", "KlÃ¸ver 3"][verdiBoms];
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
                this.verdiBoms = 16; //KlÃ¸ver 3
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
        if (verdi == null) { return []; }
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
        if (verdi == null) { return []; }
        var ret = [];
        verdi.forEach(element => {
            var kb = new KortBunke(element.nick);
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
