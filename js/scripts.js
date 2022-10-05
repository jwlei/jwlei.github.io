(function($) {

    // Show current year
    $("#current-year").text(new Date().getFullYear());

    // Remove no-js class
    $('html').removeClass('no-js');

    // Animate to section when nav is clicked
    $('navbar a').click(function(e) {

        // Treat as normal link if no-scroll class
        if ($(this).hasClass('no-scroll')) return;

        e.preventDefault();
        var heading = $(this).attr('href');
        var scrollDistance = $(heading).offset().top;

        $('html, body').animate({
            scrollTop: scrollDistance + 'px'
        }, Math.abs(window.pageYOffset - $(heading).offset().top) / 1);

        // Hide the menu once clicked if mobile
        if ($('header').hasClass('active')) {
            $('header, body').removeClass('active');
        }
    });

    // Scroll to top
    $('#to-top').click(function() {
        $('html, body').animate({
            scrollTop: 0
        }, 500);
    });

    // Scroll to first element
    $('#lead-down span').click(function() {
        var scrollDistance = $('#lead-section').next().offset().top;
        $('html, body').animate({
            scrollTop: scrollDistance + 'px'
        }, 500);
    });

    // Create timeline
    $('#experience-timeline').each(function() {
        $this = $(this); // Store reference to this
        $userContent = $this.children('div'); // user content

        // Create each timeline block
        $userContent.each(function() {
            $(this).addClass('vtimeline-content').wrap('<div class="vtimeline-point"><div class="vtimeline-block"></div></div>');
        });

        // Add icons to each block
        $this.find('.vtimeline-point').each(function() {
            $(this).prepend('<div class="vtimeline-icon"><i class="fa fa-map-marker"></i></div>');
        });

        // Add dates to the timeline if exists
        $this.find('.vtimeline-content').each(function() {
            var date = $(this).data('date');
            if (date) { // Prepend if exists
                $(this).parent().prepend('<span class="vtimeline-date">'+date+'</span>');
            }
        });

    });

    // Open mobile menu
    $('#mobile-menu-open').click(function() {
        $('header, body').addClass('active');
    });

    // Close mobile menu
    $('#mobile-menu-close').click(function() {
        $('header, body').removeClass('active');
    });

    // Load additional projects
    $('#view-more-projects').click(function(e){
        e.preventDefault();
        $(this).fadeOut(300, function() {
            $('#more-projects').fadeIn(300);
        });
    });

    // MOUSE SCROLL
    // var delay = false;
    // $(document).on('mousewheel DOMMouseScroll', function(event) {
    //     event.preventDefault();
    //     if(delay) return;
    //
    //     delay = true;
    //     setTimeout(function(){delay = false},700 )
    //
    //     var wd = event.originalEvent.wheelDelta || -event.originalEvent.detail;
    //
    //     var links = document.getElementsByTagName('section');
    //     var link;
    //     if(wd < 0) {
    //         link = findNext(links);
    //     }
    //     else {
    //         link = findPrevious(links);
    //     }
    //
    //     animate(link);
    // });

    $('body').keydown(function(e){
        if(e.keyCode === 8 || e.keyCode === 33 ){
            e.preventDefault();
            // user has pressed backspace or page up
            var links = document.getElementsByTagName('section');
            link = findPrevious(links);
            animate(link);
        }
        if(e.keyCode === 32 || e.keyCode === 34){
            e.preventDefault();
            // user has pressed space or page down
            var section = document.getElementsByTagName('section');
            link = findNext(section);
            animate(link);
        }
    });

    function findNext(section) {
        for(var i = 0 ; i < section.length ; i++) {
            var t = section[i].getClientRects()[0].top;
            if(t >= 40) return section[i];
        }
    }

    function findPrevious(section) {
        for(var i = section.length-1 ; i >= 0 ; i--) {
            var t = section[i].getClientRects()[0].top;
            if(t < -20) return section[i];
        }
    }

    function animate(section) {
        if( section ) {
            $('html,body').animate({
                scrollTop: section.offsetTop
            });
        }
    }
})(jQuery);











// -----------------------------------------------------------------------------------
// LANGUAGE
// -----------------------------------------------------------------------------------
const defaultLocale = 'en';
const supportedLocales = ['en', 'no'];
// The active locale
let locale;

// Gets filled with active locale translations
let translations = {};

// When the page content is ready...
document.addEventListener("DOMContentLoaded", () => {
    const initialLocale =
        supportedOrDefault(browserLocales(true));
    setLocale(initialLocale);
    bindLocaleSwitcher(initialLocale);
});


function isSupported(locale) {
    // Check if locale is supported
    return supportedLocales.indexOf(locale) > -1;
}

function supportedOrDefault(locales) {
    // Retrieve the first locale we support from the given
    // array, or return our default locale
    return locales.find(isSupported) || defaultLocale;
}

function browserLocales(languageCodeOnly = false) {
    return navigator.languages.map((locale) =>
        languageCodeOnly ? locale.split("-")[0] : locale,
    );
}


function bindLocaleSwitcher(initialValue) {
    // Whenever the user selects a new locale, we
    // load the locale's translations and update
    // the page
    const switcher = document.querySelector("[i18n-lang-switcher]");
    switcher.value = initialValue;
    switcher.onchange = (e) => {
        // Set the locale to the selected option[value]
        setLocale(e.target.value);
    };
}

async function getLocale(){
    if(navigator.language === ('no' || 'nb' || 'nn')){
        return 'no';
    } else {
        return 'en';
    }
}


async function setLocale(newLocale) {
    // Load translations for the given locale and translate
    // the page to this locale
    if (newLocale === locale) return;

    const newTranslations = await fetchTranslationsFor(newLocale);
    locale = newLocale;
    translations = newTranslations;

    translatePage();
}


async function fetchTranslationsFor(newLocale) {
    // Retrieve translations JSON object for the given
    // locale over the network
    const response = await fetch(`/language/${newLocale}.json`);
    return await response.json();
}


function translatePage() {
    // Replace the inner text of each element that has a
    // data-i18n-key attribute with the translation corresponding
    // to its data-i18n-key
    document.querySelectorAll("[i18n-key]").forEach(translateElement);
    changePortfolioDlLink()
}


function translateElement(element) {
    // Replace the inner text of the given HTML element
    // with the translation in the active locale,
    // corresponding to the element's data-i18n-key
    const key = element.getAttribute("i18n-key");
    element.innerText = translations[key];
}


function changePortfolioDlLink() {
    // Change link depending on language
    const link = document.getElementById("cv-dl");
    link.getAttribute("href");

    if (locale === "no") {
        link.setAttribute("href",
        "/files/cv_no.pdf");
    } else {
        link.setAttribute("href",
        "/files/cv_en.pdf");
    }
}
// -----------------------------------------------------------------------------------
// END LANGUAGE
// -----------------------------------------------------------------------------------


// -----------------------------------------------------------------------------------
// ANIMATION
// -----------------------------------------------------------------------------------



window.onscroll = function() {scrollFunction()};

function scrollFunction() {
    // When the user scrolls down 80px from the top of the document, resize the navbar padding and the logo's font size
    var menuLang = document.getElementsByClassName("menu-lang");

    if (document.body.scrollTop > 80 || document.documentElement.scrollTop > 80) {
        document.getElementById("navbar").style.padding = "3px 10px";
        document.getElementById("navbar").style.fontSize = "0.9em";
        menuLang.setAttribute("style", "font-size: 0.8em");
        menuLang.setAttribute("style", "padding: 3px 5px");
    } else {
        document.getElementById("navbar").style.padding = "16px 10px";
        document.getElementById("navbar").style.fontSize = "1em";
        menuLang.setAttribute("style", "font-size: 0.9em");
        menuLang.setAttribute("style", "padding: 16px 5px");
    }
}
