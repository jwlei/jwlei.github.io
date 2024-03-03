class CardsOnTable extends Array {
    constructor(nickname, ...cards) {
        super(...cards);
        if (this.length > 0) {
            this.tycoonValue = this[0].tycoonValue;
            this.forEach(card => {
                if (card.tycoonValue != this.tycoonValue) {
                    throw new Error("Can't put different cards");
                }
            });
        } else {
            this.tycoonValue = null;
        }
        this.nickname = nickname;
    }

    push(card) {
        if (this.tycoonValue != null) {
            if (card.tycoonValue != this.tycoonValue) {
                throw new Error("Can't put different cards.");
            }
        } else {
            this.tycoonValue = card.tycoonValue;
        }
        super.push(card);
    }

    setValues(cardsOnTable) {
        this.nickname = cardsOnTable.nickname;
        this.length = 0; // Clear the current array

        for (const card of cardsOnTable) {
            if (!(card instanceof TycoonCards)) {
                card = new TycoonCards(card.suit, card.value);
            }
            this.push(card);
        }
        return this;
    }

    getText() {
        if (this.length === 0) {
            return "No cards";
        }

        if (this[0].clubsThree()) {
            return "Three of clubs";
        }

        const cardCountText = ["", "one", "two", "three", "four", "five", "six", "seven"][this.length];
        const cardValue = Card.cardValue(this[0].value);

        return `${cardCountText} ${this.length > 1 ? cardValue.namePlural : cardValue.nameSingular}`;
    }

    checkValidMove(currentCards) {
        return (
            (currentCards == null)
            || (this.length == currentCards.length && this.tycoonValue >= currentCards.tycoonValue)
            || (this.length == 1 && this[0].clubsThree())
        );
    }
}