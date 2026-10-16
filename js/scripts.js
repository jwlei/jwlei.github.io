(function($) {

    // Show current year
    $("#current-year").text(new Date().getFullYear());

    // Remove no-js class
    $('html').removeClass('no-js');

    function setupScrollReveal() {
        var reducedMotion = window.matchMedia &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reducedMotion || !('IntersectionObserver' in window)) return;

        var targets = document.querySelectorAll(
            '#about, #skills .row, #experience .vtimeline-point, .education-block, .project'
        );
        var staggerTargets = document.querySelectorAll(
            '#skills .row, #experience .vtimeline-point, .education-block, .project'
        );
        staggerTargets.forEach(function(target, index) {
            target.style.setProperty('--reveal-delay', `${Math.min(index * 45, 180)}ms`);
        });

        var observer = new IntersectionObserver(function(entries, currentObserver) {
            entries.forEach(function(entry) {
                if (!entry.isIntersecting) return;
                entry.target.classList.add('is-visible');
                currentObserver.unobserve(entry.target);
            });
        }, {threshold: 0.08, rootMargin: '0px 0px -32px 0px'});

        targets.forEach(function(target) {
            target.classList.add('reveal');
            observer.observe(target);
        });
    }
    
    $('header a').click(function(e) {

        // Treat as normal link if no-scroll class
        if ($(this).hasClass('no-scroll')) return;

        var heading = $(this).attr('href');
        if (!heading || !heading.startsWith('#')) return;
        var target = document.querySelector(heading);
        if (!target) {
            console.error(`Navigation target not found: ${heading}`);
            return;
        }

        e.preventDefault();
        var scrollDistance = $(target).offset().top;

        animateScroll(scrollDistance, 350);

        // Hide the menu once clicked if mobile
        if ($('header').hasClass('active')) {
            setMobileMenuOpen(false, false);
        }
        target.focus({preventScroll: true});
    });
    
    // Scroll to top
    $('#to-top').click(function() {
        animateScroll(0, 200);
        document.getElementById('hero-heading').focus({preventScroll: true});
    });
    

    // Scroll to first element
    $('#lead-down button').click(function() {
        var target = $('#lead-section').next()[0];
        var scrollDistance = $(target).offset().top;
        animateScroll(scrollDistance, 200);
        target.focus({preventScroll: true});
    });

    function animateScroll(position, duration) {
        var reducedMotion = window.matchMedia &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        $('html, body').stop().animate({
            scrollTop: position
        }, reducedMotion ? 0 : duration);
    }

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

    setupScrollReveal();

    // Open mobile menu
    $('#mobile-menu-open').click(function() {
        setMobileMenuOpen(true);
    });

    // Close mobile menu
    $('#mobile-menu-close').click(function() {
        setMobileMenuOpen(false);
    });
    
    $('section').click(function() {
        if ($('header').hasClass('active')) {
            setMobileMenuOpen(false, false);
        }
    });

    $(document).keydown(function(e) {
        if (e.key === 'Escape' && $('header').hasClass('active')) {
            setMobileMenuOpen(false);
        }
    });

    function setMobileMenuOpen(isOpen, returnFocus = true) {
        var header = document.getElementById('navbar');
        var openButton = document.getElementById('mobile-menu-open');
        var closeButton = document.getElementById('mobile-menu-close');

        header.classList.toggle('active', isOpen);
        document.body.classList.toggle('active', isOpen);
        openButton.setAttribute('aria-expanded', String(isOpen));

        if (isOpen) {
            closeButton.focus();
        } else if (returnFocus && document.activeElement === closeButton) {
            openButton.focus();
        }
    }

    // Load additional projects
    $('#view-more-projects').click(function(e){
        e.preventDefault();
        $(this).fadeOut(300, function() {
            $('#more-projects').fadeIn(300);
        });
    });


    // -----------------------------------------------------------------------------------
    const carouselText = [
        {text: "UI/UX"},
        {text: "Java" },
        {text: "PL/SQL"},
        {text: "C#"},
        {text: "Responsive Design"},
        {text: "Large language models"},
        {text: "Web development"},
        {text: "Database management systems"},
        {text: "Spring MVC"}
    ]

    jQuery(function ($) {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            $('#feature-text').text('Java');
            return;
        }

        // Randomly shuffle CarouselText
      for (let i = carouselText.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [carouselText[i], carouselText[j]] = [carouselText[j], carouselText[i]];
        }
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
        await waitForMs(40);
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
          await waitForMs(1000);
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


async function setLocale(newLocale) {
    // Load translations for the given locale and translate
    // the page to this locale
    if (newLocale === locale) return;
    if (!isSupported(newLocale)) {
        throw new RangeError(`Unsupported locale: ${newLocale}`);
    }

    const newTranslations = await fetchTranslationsFor(newLocale);
    locale = newLocale;
    translations = newTranslations;
    document.documentElement.lang = newLocale === "no" ? "nb" : "en";
    document.querySelectorAll(".language-switcher").forEach(button => {
        button.setAttribute("aria-pressed", String(
            button.getAttribute("i18n-aria-label") === `language-${newLocale === "no" ? "norwegian" : "english"}`
        ));
    });

    translatePage();
}


async function fetchTranslationsFor(newLocale) {
    // Retrieve translations JSON object for the given
    // locale over the network
    const response = await fetch(`/language/${newLocale}.json`);
    if (!response.ok) {
        throw new Error(`Unable to load ${newLocale} translations: ${response.status}`);
    }
    return await response.json();
}


function translatePage() {
    // Replace the inner text of each element that has a
    // data-i18n-key attribute with the translation corresponding
    // to its data-i18n-key
    document.querySelectorAll("[i18n-key]").forEach(translateElement);
    document.querySelectorAll("[i18n-aria-label]").forEach(element => {
        const key = element.getAttribute("i18n-aria-label");
        const label = translations[key];
        if (typeof label !== "string") {
            console.error(`Missing translation for aria-label: ${key}`);
            return;
        }
        element.setAttribute("aria-label", label);
    });
    document.querySelectorAll("[i18n-date-key]").forEach(element => {
        const key = element.getAttribute("i18n-date-key");
        const date = translations[key];
        if (typeof date !== "string") {
            console.error(`Missing translation for date: ${key}`);
            return;
        }
        element.setAttribute("data-date", date);
        const renderedDate = element.parentElement.querySelector(".vtimeline-date");
        if (renderedDate) renderedDate.innerText = date;
    });
    changePortfolioDlLink()
}


function translateElement(element) {
    // Replace the inner text of the given HTML element
    // with the translation in the active locale,
    // corresponding to the element's data-i18n-key
    const key = element.getAttribute("i18n-key");
    const translatedText = translations[key];
    if (typeof translatedText !== "string") {
        console.error(`Missing translation: ${key}`);
        return;
    }
    element.textContent = translatedText;
}


function changePortfolioDlLink() {
    // Change link depending on language
    const link = document.getElementById("cv-dl");

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
