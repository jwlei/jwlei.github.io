/// <reference path="../tycoon/tycooncards.js" />
class TycoonPlayer extends Player {
    constructor(nickname, playerId) {
        super(nickname, playerId);
        this.title = "";
    }

    getValues() {
        let values = super.getValues();
        values.playedLastCards = TycoonCards.getDeckCardCodes(values.playedLastCards);
        values.title = this.title;
        return values;
    }

    setValues(playerObject) {
        playerObject.playedLastCards = ((playerObject.playedLastCards == null) ? null :
            ((playerObject.playedLastCards.tycoonValue) ? new CardsOnTable(playerObject.playedLastCards.nickname).setValues(playerObject.playedLastCards) :
                playerObject.playedLastCards));
        super.setValues(playerObject);
        this.title = playerObject.title;
        return this;
    }

    getCountSameCard(tycoonValue) {
        return this.card.filter(card => (card.tycoonValue == tycoonValue)).length;
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
        return players.map(player => player.getValues());
    }

    static setPlayers(players) {
        return players.map(element => (new TycoonPlayer()).setValues(element));
        //var players = [];
        //players.forEach(element => {
        //    players.push((new TycoonPlayer()).setValues(element));
        //});
        //return players;
    }
}