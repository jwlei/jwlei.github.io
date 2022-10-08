(function($) {


    // Show current year
    $("#current-year").text(new Date().getFullYear());

    // Remove no-js class
    $('html').removeClass('no-js');
    
    $('header a').click(function(e) {

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
        }, 200);
    });
    

    // Scroll to first element
    $('#lead-down span').click(function() {
        var scrollDistance = $('#lead-section').next().offset().top;
        $('html, body').animate({
            scrollTop: scrollDistance + 'px'
        }, 200);
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
    
    $('section').click(function() {
        if ($('header').hasClass('active')) {
            $('header, body').removeClass('active');
        }
    });

    // Load additional projects
    $('#view-more-projects').click(function(e){
        e.preventDefault();
        $(this).fadeOut(300, function() {
            $('#more-projects').fadeIn(300);
        });
    });


    $('body').keydown(function(e){
        if(e.keyCode === 33 ){
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

    // Disable previous when on contact-form
    jQuery('#contact-form').bind('keydown', function(e) {
        e.stopPropagation();
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

    // -----------------------------------------------------------------------------------
    const carouselText = [
        {text: "UI/UX"},
        {text: "Java"},
        {text: "Responsive Design"},
        {text: "Artificial intelligence"},
        {text: "Web development"},
        {text: "Database management systems"},
        {text: "Spring MVC"}
    ]

    jQuery(function($) {
      carousel(carouselText, "#feature-text")
    });

    async function typeSentence(sentence, eleRef, delay = 100) {
      const letters = sentence.split("");
      let i = 0;
      while(i < letters.length) {
        await waitForMs(delay);
        $(eleRef).append(letters[i]);
        i++
      }
      return;
    }

    async function deleteSentence(eleRef) {
      const sentence = $(eleRef).html();
      const letters = sentence.split("");
      let i = 0;
      while(letters.length > 0) {
        await waitForMs(100);
        letters.pop();
        $(eleRef).html(letters.join(""));
      }
    }

    async function carousel(carouselList, eleRef) {
        var i = 0;
        while(true) {
          await typeSentence(carouselList[i].text, eleRef);
          await waitForMs(1500);
          await deleteSentence(eleRef);
          await waitForMs(500);
          i++
          if(i >= carouselList.length) {i = 0;}
        }
    }

    function waitForMs(ms) {
      return new Promise(resolve => setTimeout(resolve, ms))
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



window.onscroll = function() {navbarShrinkOnScroll()};

function navbarShrinkOnScroll() {
    // When the user scrolls down 80px from the top of the document, resize the navbar padding and the logo's font size
    if (document.body.scrollTop > 80 || document.documentElement.scrollTop > 80) {
        document.getElementById("navbar").style.padding = "3px 10px";
        document.getElementById("navbar").style.fontSize = "0.9em";
    } else {
        document.getElementById("navbar").style.padding = "16px 10px";
        document.getElementById("navbar").style.fontSize = "1em";
    }
}

function isScroller(el) {
    var isScrollableWidth, isScollableHeight, elStyle;
    elStyle = window.getComputedStyle(el, null); // Note: IE9+
    if (elStyle.overflow === 'scroll' ||
        elStyle.overflowX === 'scroll' ||
        elStyle.overflowY === 'scroll') {
        return true;
    }
    if (elStyle.overflow === 'auto' ||
        elStyle.overflowX === 'auto' ||
        elStyle.overflowY === 'auto') {
        if (el.scrollHeight > el.clientHeight) {
            return true;
        }
        if (el.scrollWidth > el.clientWidth) {
            return true;
        }
    }
    return false;
}

var els = document.querySelectorAll('body *');
for (var i = 0, el; el = els[i]; i++) {
    if (isScroller(el)) {
        console.log(el);
    }
}


