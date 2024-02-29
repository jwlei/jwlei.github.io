class Deck {
    constructor() {
        this.cards = [];
        this.addCardsToDeck();
    }

    newCards(suit, value) {
        return new Card(suit, value);
    }

    addCardsToDeck() {
        for (let suit = 1; suit <= 4; suit++) {
            for (let value = 1; value <= 13; value++) {
                this.cards.push(this.newCards(suit, value));
            }
        }
    }

    shuffle() {
        for (var i = this.cards.length - 1; i > 0; i--) {
            let n = Math.floor(Math.random() * (i + 1));
            var husk = this.cards[i];
            this.cards[i] = this.cards[n];
            this.cards[n] = husk;
        }
    }

    sort() {
        if (this.cards.length <= 1) { return; }
        this.cards.sort(this.cards[0].sortFunc);
    }
}