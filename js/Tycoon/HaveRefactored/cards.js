class Card {
    constructor(suit, value) {
        this.suit = suit;
        this.value = value;
    }

    static cardSuit(suitValueNum) {
        // Returns a suit object with name and key properties (e.g. {name: "Hearts", key: "H"}) for the value of suitValueNum
        return [
            {},
            { key: "D", name: "Diamonds" },
            { key: "H", name: "Hearts" },
            { key: "S", name: "Spades" },
            { key: "C", name: "Clubs" }
        ][suitValueNum];
    }

    static cardValue(cardValueNum) {
        // Returns a value object for the value of cardValueNum
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

    getCardCode() {
        // returns a string like "S2" for the 2 of spades
        return `${Card.cardSuit(this.suit).key}${Card.cardValue(this.value).key}`;
    }

    getCardName() {
        // returns a string like "Two of Spades" for the 2 of spades
        return ` ${Card.cardValue(this.value).name} of ${Card.cardSuit(this.suit).name}`;
    }

    getImageUrlFront() {
        return `../media/images/card_back/${Card.cardValue(this.value).key}${Card.cardSuit(this.suit).key}.jpg`;
    }

    static sortFunc(card_A, card_B) {
        // sort by suit, then by value
        return (card_A.suit - card_B.suit) * 100 + (card_A.value - card_B.value);
    }
    static cardBackColor(color = 0) {
        // returns a color object with name and key properties (e.g. {name: "blue", key: "blue"}) for the value of color
        return {
            getImageUrlBack() { return `../media/images/card_back/${(color == 0) ? "blue" : "yellow"}_back.jpg`; },
            getName() { return ""; }
        }
    }
}