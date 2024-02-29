class SpillerBoms extends player {
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
            //Nullstiller bare hvis spilleren fortsatt er med pÃ¥ runden.
            //Nullstiller ogsÃ¥ hvis det ikke var noen sin tur (nytt spill)
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