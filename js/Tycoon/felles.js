function showDialog(dialogNavn, synlig) {
    if (synlig) {
        document.querySelector(`#dialog${dialogNavn}`).classList.add('dialog-container--visible');
        var x = document.querySelector(`#dialog${dialogNavn} .autofocus`);
        if (x) { x.focus(); }
    } else {
        document.querySelector(`#dialog${dialogNavn}`).classList.remove('dialog-container--visible');
    }
};

function setCookie(cname, cvalue, exdays) {
    var d = new Date();
    d.setTime(d.getTime() + (exdays * 24 * 60 * 60 * 1000));
    var expires = "expires=" + d.toUTCString();
    document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
}

function getCookie(cname) {
    var name = cname + "=";
    var ca = document.cookie.split(';');
    for (var i = 0; i < ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0) == ' ') {
            c = c.substring(1);
        }
        if (c.indexOf(name) == 0) {
            return c.substring(name.length, c.length);
        }
    }
    return "";
}

function openFullscreen(elem) {
    if (elem.requestFullscreen) {
        elem.requestFullscreen();
    } else if (elem.mozRequestFullScreen) { /* Firefox */
        elem.mozRequestFullScreen();
    } else if (elem.webkitRequestFullscreen) { /* Chrome, Safari & Opera */
        elem.webkitRequestFullscreen();
    } else if (elem.msRequestFullscreen) { /* IE/Edge */
        elem.msRequestFullscreen();
    }
}

function closeFullscreen() {
    if (document.exitFullscreen) {
        document.exitFullscreen();
    } else if (document.mozCancelFullScreen) { /* Firefox */
        document.mozCancelFullScreen();
    } else if (document.webkitExitFullscreen) { /* Chrome, Safari and Opera */
        document.webkitExitFullscreen();
    } else if (document.msExitFullscreen) { /* IE/Edge */
        document.msExitFullscreen();
    }
}

function harClass(element, name) {
    return element.className.split(" ").filter(txt => { return txt == name; }).length > 0;
}

function fixClass(element, name, inn = true) {
    var classer = element.className.split(" ");
    var arr = classer.filter(txt => { return txt != name; });
    element.className = arr.join(" ") + ((inn) ? ` ${name}` : "");
    return classer.length != element.className.split(" ").length;
}

function getSpillerKey() {
    var key = getCookie("SpillerKey");
    if (key == "") {
        for (let i = 0; i < 50; i++) {
            const tegn = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z"];
            key += tegn[Math.trunc(Math.random() * (tegn.length))];
        }
        setCookie("SpillerKey", key, 1000);
    }
    return key;
}