var huskTimerHoppover = null;

function setTimerHoppover(spill) {
    if (huskTimerHoppover != null) {
        clearTimeout(huskTimerHoppover);
    }
    huskTimerHoppover = setTimeout(function () {
        var HoppOverSpiller = spill.spillere[spill.sinTur]; //Husker på nummeret slik at det er statisk (i tilfelle flere trykker samtidig).
        Layout.TegneHoppover([
            "Gjør det beste",
            "Hopp over",
            "Si pass",
            "Avslutt spiller"
        ], [function () {
            AutoSpiller2(spill, HoppOverSpiller, true);
        }, function () {
            spill.NesteSinTur();
        }, function () {
            spill.SpillerPass(HoppOverSpiller);
        }, function () {
            spill.AvsluttSpiller(HoppOverSpiller);
        }]);
    }, 20000); //Kommer opp hvis spiller ikke har gjort noe på 20 sekunder.
}