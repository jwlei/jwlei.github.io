class KortBunke extends Array {
    constructor(nick, ...korter) {
        super(...korter);
        if (this.length > 0) {
            this.verdiBoms = this[0].verdiBoms;
            this.forEach(k => {
                if (k.verdiBoms != this.verdiBoms) { throw ("Kan ikke legge pÃ¥ forskjellige card."); }
            });
        } else {
            this.verdiBoms = null;
        }
        this.nick = nick;
    }
    push(item) {
        if (this.verdiBoms != null) {
            if (item.verdiBoms != this.verdiBoms) { throw ("Kan ikke legge pÃ¥ forskjellige card."); }
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
        if (this.length == 0) { return "ingen card"; };
        if (this[0].Klover3()) { return "klÃ¸ver 3"; };
        return ["", "en", "to", "tre", "fire", "fem", "seks", "syv"][this.length] + " " + ((this.length > 1) ? Kort.VerdiNavn(this[0].verdi).navnflertall : Kort.VerdiNavn(this[0].verdi).navnentall);
    }
    KanLeggesPa(overst) {
        return (
            (overst == null) || // FÃ¸rste som legges pÃ¥
            (this.length == overst.length && this.verdiBoms >= overst.verdiBoms) || // Normale regler
            (this.length == 1 && this[0].Klover3()) // KlÃ¸ver tre
        );
    }
}