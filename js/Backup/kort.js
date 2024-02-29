class Kortstokk extends Array {
    constructor(...items) {
        super(...items);
    }
    LeggTil52Kort(nyekort = function (farge, verdi) { return new Kort(farge, verdi) }) {
        for (let farge = 1; farge <= 4; farge++) {
            for (let verdi = 1; verdi <= 13; verdi++) {
                this.push(nyekort(farge, verdi));
            }
        }
    }
    Bland() {
        for (var i = this.length - 1; i > 0; i--) {
            var n = Math.floor(Math.random() * (i + 1));
            var husk = this[i];
            this[i] = this[n];
            this[n] = husk;
        }
    }
    Sorter() {
        if (this.length <= 1) { return; }
        this.sort(this[0].sortFunc);
    }
}

class Kort {
    static FargeNavn(fargenummer) {
        return [
            {},
            { navn: "Spar", kode: "S" },
            { navn: "Hjerter", kode: "H" },
            { navn: "Kløver", kode: "C" },
            { navn: "Ruter", kode: "D" }
        ][fargenummer];
    }
    static VerdiNavn(verdinummer) {
        return [
            {},
            { navn: "Ess", navnentall: "Ess", navnflertall: "Ess", kode: "A" },
            { navn: "2", navnentall: "toer", navnflertall: "toere", kode: "2" },
            { navn: "3", navnentall: "treer", navnflertall: "treere", kode: "3" },
            { navn: "4", navnentall: "firer", navnflertall: "firere", kode: "4" },
            { navn: "5", navnentall: "femer", navnflertall: "femere", kode: "5" },
            { navn: "6", navnentall: "sekser", navnflertall: "seksere", kode: "6" },
            { navn: "7", navnentall: "syver", navnflertall: "syvere", kode: "7" },
            { navn: "8", navnentall: "åtter", navnflertall: "åttere", kode: "8" },
            { navn: "9", navnentall: "nier", navnflertall: "niere", kode: "9" },
            { navn: "10", navnentall: "tier", navnflertall: "tiere", kode: "0" },
            { navn: "Knekt", navnentall: "Knekt", navnflertall: "Knekter", kode: "J" },
            { navn: "Dame", navnentall: "Dame", navnflertall: "Damer", kode: "Q" },
            { navn: "Konge", navnentall: "Konge", navnflertall: "Konger", kode: "K" }
        ][verdinummer];
    }
    constructor(farge, verdi) {
        this.farge = farge;
        this.verdi = verdi;
    }
    Kode() { return `${Kort.FargeNavn(this.farge).kode}${Kort.VerdiNavn(this.verdi).kode}`; }
    Navn() { return `${Kort.FargeNavn(this.farge).navn} ${Kort.VerdiNavn(this.verdi).navn}`; }
    Img() { return `kort/${Kort.VerdiNavn(this.verdi).kode}${Kort.FargeNavn(this.farge).kode}.png`; }
    static sortFunc(a, b) {
        return (a.farge - b.farge) * 100 + (a.verdi - b.verdi);
    }
    static BakgrunnKort(variant = 0) {
        return {
            Img() { return `kort/${(variant == 0) ? "blue" : "yellow"}_back.png`; },
            Navn() { return ""; }
        }
    }
}