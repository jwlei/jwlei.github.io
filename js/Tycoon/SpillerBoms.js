class TycoonPlayer extends Player {
    constructor(nickname, playerId) {
        super(nickname, playerId);
        this.title = "";
    }

    getValues() {
        var ret = super.getValues();
        ret.playedLastCards = KortBoms.KortstokkBunkeKode_get(ret.playedLastCards);
        ret.tittel = this.title;
        return ret;
    }

    setValues(playerObject) {
        playerObject.laPaaSist = ((playerObject.laPaaSist == null) ? null :
            ((playerObject.laPaaSist.verdiBoms) ? new KortBunke(playerObject.laPaaSist.nick).setVerdier(playerObject.laPaaSist) :
                playerObject.laPaaSist));
        super.setValues(playerObject);
        this.title = playerObject.tittel;
        return this;
    }

    antallMedVerdiBoms(verdiBoms) {
        return this.card.filter(k => (k.verdiBoms == verdiBoms)).length;
    }

    resetTurn(playerObject) {
        super.resetTurn(playerObject);
        if (playerObject === null || (this.playedLastCards !== "Pass" && this.placement == 0)) {
            // Nullstiller bare hvis spilleren fortsatt er med på runden.
            // Nullstiller også hvis det ikke var noen sin tur (nytt spill)
            this.playedLastCards = null;
        }
    }

    static getPlayers(players) {
        let ret = [];
        players.forEach(player => {
            ret.push(player.getValues());
        });
        return ret;
    }

    static setPlayers(playerValue) {
        var players = [];
        playerValue.forEach(element => {
            players.push((new TycoonPlayer()).setValues(element));
        });
        return players;
    }
}