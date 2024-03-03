class TycoonCards extends cards {
    constructor(suit, value) {
        super(suit, value);

        if (this.value > 3) {
            this.tycoonValue = this.value;
        } else if (this.value < 3) {
            this.tycoonValue = this.value + 13;
        } else {
            this.tycoonValue = (this.suit === 3) ? 16 : 3;
        }
        Object.defineProperty(this, "tycoonValue", { enumerable: false });
    }

    static clubsThreeValue() {
        return 16;
    }

    static tycoonCardValueConversion(tycoonValue) {
        return ["", "", "", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A", "2", "Three of clubs"][tycoonValue];
    }

    clubsThree() {
        return (this.tycoonValue === 16);
    }

    sort(card_A, card_B) {
        return (card_A.verdiBoms - card_B.verdiBoms) * 10 + (card_A.suit - card_B.suit);
    }

    static getDeckCardValue(deck) {
        return deck.map(card => ({ suit: card.suit, value: card.value }));
        //var ret = [];
        //deck.forEach(card => {
        //    ret.push({ suit: card.suit, value: card.value });
        //});
        //return ret;
    }

    static setDeckCardValue(value) {
        if (value == null) {
            return [];
        }

        return value.map(element => new TycoonCards(element.suit, element.value));

        //var ret = new Kortstokk();
        //value.forEach(element => {
        //    ret.push(new TycoonCards(element.suit, element.value));
        //});
        //return ret;
    }

    static getDeckCardCodes(deck) {
        return deck.slice();
        //var ret = [];
        //deck.forEach(kb => {
        //    ret.push(kb);
        //});
        //return ret;
    }

    static setDeckCardCodes(value) {
        if (value == null) {
            return [];
        }
        return value.map(element => {
            let playerCards = new CardsOnTable(value.nickname);
            value.forEach(element => value.push(new TycoonCards(element.suit, element.value)));
            return playerCards;
        });

        //var ret = [];
        //value.forEach(element => {
        //    var kb = new CardsOnTable(element.nick);
        //    var index = 0;
        //    while (element[index]) {
        //        const el = element[index];
        //        kb.push(new TycoonCards(el.farge, el.verdi));
        //        index++;
        //    }
        //    ret.push(kb);
        //});
        //return ret;
    }
}