class Deck {
    constructor() {
        this.cardsInDeck = [];
        this.addCardsToDeck();
    }

    newCards(suit, value) {
        return new Card(suit, value)
    }

    addCardsToDeck() {
        for (let suit = 1; suit <= 4; suit++) {
            for (let value = 1; value <= 13; value++) {
                this.push(nyekort(suit, value));
            }
        }
    }
    shuffle() {
        for (let i = this.length - 1; i > 0; i--) {
            let n = Math.floor(Math.random() * (i + 1));
            let m = this[i];
            this[i] = this[n];
            this[n] = m;
        }
    }
    sort() {
        if (this.length <= 1) { return; }
        this.sort(this[0].sortFunc);
    }
}

class Card {
    constructor(suit, value) {
        this.suit = suit;
        this.value = value;
    }

    static suitValueName(suitValueNum) {
        return [
            {},
            { name: "Diamonds", key: "D" },
            { name: "Hearts", key: "H" },
            { name: "Spades", key: "S" },
            { name: "Clubs", key: "C" }
        ][suitValueNum];
    }
    static cardValueName(cardValueNum) {
        return [
            {},
            { key: "A", name: "Ace", nameSingle: "Ace", namePlural: "Aces" },
            { key: "2", name: "Two", nameSingle: "Two", namePlural: "Twos" },
            { key: "3", name: "Three", nameSingle: "Three", namePlural: "Threes" },
            { key: "4", name: "Four", nameSingle: "Four", namePlural: "Fours" },
            { key: "5", name: "Five", nameSingle: "Five", namePlural: "Fives" },
            { key: "6", name: "Six", nameSingle: "Six", namePlural: "Sixes" },
            { key: "7", name: "Seven", nameSingle: "Seven", namePlural: "Sevens" },
            { key: "8", name: "Eight", nameSingle: "Eight", namePlural: "Eights" },
            { key: "9", name: "Nine", nameSingle: "Nine", namePlural: "Nines" },
            { key: "10", name: "Ten", nameSingle: "Ten", namePlural: "Tens" },
            { key: "J", name: "Jack", nameSingle: "Jack", namePlural: "Jacks" },
            { key: "Q", name: "Queen", nameSingle: "Queen", namePlural: "Queens" },
            { key: "K", name: "King", nameSingle: "King", namePlural: "Kings" }
        ][cardValueNum];
    }

    getCardKeySuit() {
        // returns the value of the card in the format "AS" for Ace of Spades
        return `${Card.suitValueName(this.suit).key}${Card.cardValueName(this.value).key}`;
    }

    getCardName() {
        // returns the name of the card in the format "Ace of Spades"
        return `${Card.cardValueName(this.value).name} of ${Card.suitValueName(this.suit).name}`;
    }

    getCardImageUrlFront() {
        return `../media/images/card_front/${Card.cardValue(this.value).key}${Card.cardSuit(this.suit).key}.jpg`;
    }

    static sortFunc(card_A, card_B) {
        return (this.card_A.suit - card_B.suit) * 100 + (card_A.value - card_B.value);
    }

    static getCardbackColour(cardBackNum = 0) {
        return {
            getCardImageUrlBack() {
                return `../media/images/card_back/${(cardBackNum == 0) ? "blue" : "yellow"}_back.png`;
            },
            getName() {
                return "";
            }
        }
    }
}