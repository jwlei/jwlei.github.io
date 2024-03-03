class Player {
    constructor(nickname, playerId) {
        this.nickname = nickname;
        this.playerId = playerId;
        this.placement = 0;
        this.card = [];
        this.hasTurn = 0;
        this.message = [];
        this.playedLastCards = null;
    }

    getValues() {
        return {
            nickname: this.nickname,
            playerId: this.playerId,
            placement: this.placement,
            card: this.card,
            hasTurn: this.hasTurn,
            message: this.message,
            playedLastCards: this.playedLastCards ?? []
            /*
            * Nullish Coalescing Operator
            * It sets the playedLastTurn property of the returned object to:
            * An empty array [] if this.playedLastTurn is null.
            * The current value of this.playedLastTurn if it is not null.
            */
        };
    }

    setValues(playerObject) {
        this.nickname = playerObject.nickname;
        this.playerId = playerObject.playerId;
        this.placement = playerObject.placement;
        this.card = playerObject.card;
        this.hasTurn = playerObject.hasTurn;
        this.message = playerObject.message ?? [];
        this.playedLastCards = playerObject.playedLastCards;
        return this;
    }

    resetTurn(currentPlayer) {
        if (this !== currentPlayer) {
            this.message = [];
        }
    }
}