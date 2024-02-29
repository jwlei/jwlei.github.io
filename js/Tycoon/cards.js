class Card {
    static cardSuit(suitNum) {
        return [
            {},
            { navn: "Spades", kode: "S" },
            { navn: "Hearts", kode: "H" },
            { navn: "Clubs", kode: "C" },
            { navn: "Diamonds", kode: "D" }
        ][suitNum];
    }
    static cardValue(valueNum) {
        return [
            {},
            { navn: "Ace", navnentall: "Ace", navnflertall: "Ess", kode: "A" },
            { navn: "2", navnentall: "toer", navnflertall: "toere", kode: "2" },
            { navn: "3", navnentall: "treer", navnflertall: "treere", kode: "3" },
            { navn: "4", navnentall: "firer", navnflertall: "firere", kode: "4" },
            { navn: "5", navnentall: "femer", navnflertall: "femere", kode: "5" },
            { navn: "6", navnentall: "sekser", navnflertall: "seksere", kode: "6" },
            { navn: "7", navnentall: "syver", navnflertall: "syvere", kode: "7" },
            { navn: "8", navnentall: "Ã¥tter", navnflertall: "Åttere", kode: "8" },
            { navn: "9", navnentall: "nier", navnflertall: "niere", kode: "9" },
            { navn: "10", navnentall: "tier", navnflertall: "tiere", kode: "0" },
            { navn: "Knekt", navnentall: "Knekt", navnflertall: "Knekter", kode: "J" },
            { navn: "Dame", navnentall: "Dame", navnflertall: "Damer", kode: "Q" },
            { navn: "Konge", navnentall: "Konge", navnflertall: "Konger", kode: "K" }
        ][valueNum];
    }
    constructor(farge, verdi) {
        this.farge = farge;
        this.verdi = verdi;
    }

    Kode() { return `${Card.cardSuit(this.farge).kode}${Card.cardValue(this.verdi).kode}`; }
    Navn() { return `${Card.cardSuit(this.farge).navn} ${Card.cardValue(this.verdi).navn}`; }
    Img() { return `../media/images/card_back/${Card.cardValue(this.verdi).kode}${Card.cardSuit(this.farge).kode}.png`; }
    static sortFunc(a, b) {
        return (a.farge - b.farge) * 100 + (a.verdi - b.verdi);
    }
    static BakgrunnKort(variant = 0) {
        return {
            Img() { return `../media/images/card_back/${(variant == 0) ? "blue" : "yellow"}_back.png`; },
            Navn() { return ""; }
        }
    }
}