class player {
    constructor(nick, spillerKey) {
        this.nick = nick;
        this.spillerKey = spillerKey;
        this.plassering = 0;
        this.kort = [];
        this.sinTur = 0;
        this.melding = [];
        this.laPaaSist = null;
    }
    getVerdier() {
        var ret = {
            nick: this.nick,
            spillerKey: this.spillerKey,
            plassering: this.plassering,
            kort: this.kort,
            sinTur: this.sinTur,
            melding: this.melding,
            laPaaSist: ((this.laPaaSist == null) ? [] : this.laPaaSist)
        }
        return ret;
    }
    settVerdier(obj) {
        this.nick = obj.nick;
        this.spillerKey = obj.spillerKey;
        this.plassering = obj.plassering;
        this.kort = obj.kort;
        this.sinTur = obj.sinTur;
        this.melding = ((obj.melding == null) ? [] : obj.melding);
        this.laPaaSist = obj.laPaaSist;
        return this;
    }
    nullstillRunde(varSinTur) {
        if (this != varSinTur) {
            this.melding = [];
        }
    }
}