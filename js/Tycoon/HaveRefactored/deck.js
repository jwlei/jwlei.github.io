class Deck {
    constructor() {
        this.cardsInDeck = [];
        this.addCardsToDeck();
    }

    newCards(suit, value) {
        // returns a new card object
        return new Card(suit, value);
    }

    addCardsToDeck() {
        // adds 52 cards to the deck (4 suits, 13 values)
        for (let suit = 1; suit <= 4; suit++) {
            for (let value = 1; value <= 13; value++) {
                this.cardsInDeck.push(this.newCards(suit, value));
            }
        }
    }

    shuffle() {
        for (var i = this.cardsInDeck.length - 1; i > 0; i--) {
            let n = Math.floor(Math.random() * (i + 1));
            var husk = this.cardsInDeck[i];
            this.cardsInDeck[i] = this.cardsInDeck[n];
            this.cardsInDeck[n] = husk;
        }
    }

    sort() {
        // sorts the deck by suit and value
        if (this.cardsInDeck.length <= 1) { return; }
        this.cardsInDeck.sort(this.cardsInDeck[0].sortFunc);
    }
}