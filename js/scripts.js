(function($) {

    // Show current year
    $("#current-year").text(new Date().getFullYear());

    // Remove no-js class
    $('html').removeClass('no-js');

    function setupScrollReveal() {
        var reducedMotion = window.matchMedia &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reducedMotion || !('IntersectionObserver' in window)) return;

        var targets = document.querySelectorAll('.project');
        targets.forEach(function(target, index) {
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

    function setupCarousel() {
        const carousel = document.getElementById('hero-carousel');
        const track = carousel.querySelector('.carousel-track');
        const slides = Array.from(track.children);
        const dots = Array.from(carousel.querySelectorAll('.carousel-dots button'));
        const rotationButton = carousel.querySelector('.carousel-rotation');
        const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
        let index = 0;
        let paused = motion.matches;
        let hovered = false;
        let inView = !('IntersectionObserver' in window);
        let timer;

        function scheduleRotation() {
            window.clearTimeout(timer);
            const rotating = !paused && !hovered && inView && !document.hidden && !motion.matches;
            carousel.dataset.rotating = String(rotating);
            if (rotating) {
                timer = window.setTimeout(() => showSlide(index + 1), 6000);
            }
        }

        function updateRotation() {
            carousel.dataset.paused = String(paused);
            rotationButton.querySelector('[data-carousel-pause]').hidden = paused;
            rotationButton.querySelector('[data-carousel-resume]').hidden = !paused;
            rotationButton.hidden = motion.matches;
            track.setAttribute('aria-live', paused ? 'polite' : 'off');
            scheduleRotation();
        }

        function showSlide(nextIndex, manual = false) {
            if (manual) paused = true;
            index = (nextIndex + slides.length) % slides.length;
            track.style.setProperty('--slide', index);
            slides.forEach((slide, slideIndex) => {
                const active = slideIndex === index;
                slide.inert = !active;
                slide.setAttribute('aria-hidden', String(!active));
                if (active) {
                    dots[slideIndex].setAttribute('aria-current', 'true');
                } else {
                    dots[slideIndex].removeAttribute('aria-current');
                }
            });
            carousel.querySelector('.carousel-counter').textContent =
                `${String(index + 1).padStart(2, '0')} / ${String(slides.length).padStart(2, '0')}`;
            updateRotation();
        }

        carousel.querySelector('.carousel-prev').addEventListener('click', () => showSlide(index - 1, true));
        carousel.querySelector('.carousel-next').addEventListener('click', () => showSlide(index + 1, true));
        dots.forEach((dot, dotIndex) => dot.addEventListener('click', () => showSlide(dotIndex, true)));
        rotationButton.addEventListener('click', () => {
            paused = !paused;
            updateRotation();
        });
        carousel.addEventListener('focusin', event => {
            if (rotationButton.contains(event.target)) return;
            paused = true;
            updateRotation();
        });
        carousel.addEventListener('pointerenter', event => {
            if (event.pointerType !== 'mouse') return;
            hovered = true;
            scheduleRotation();
        });
        carousel.addEventListener('pointerleave', event => {
            if (event.pointerType !== 'mouse') return;
            hovered = false;
            scheduleRotation();
        });
        document.addEventListener('visibilitychange', scheduleRotation);
        motion.addEventListener('change', () => {
            if (motion.matches) paused = true;
            updateRotation();
        });
        if ('IntersectionObserver' in window) {
            const observer = new IntersectionObserver(entries => {
                inView = entries[0].isIntersecting;
                scheduleRotation();
            }, {threshold: 0.25});
            observer.observe(carousel);
        }
        carousel.querySelector('.carousel-controls').hidden = false;
        showSlide(0);
    }

    setupScrollReveal();
    setupCarousel();

})(jQuery);










// -----------------------------------------------------------------------------------
// LANGUAGE
// -----------------------------------------------------------------------------------
const defaultLocale = 'no';
const supportedLocales = ['en', 'no'];
// The active locale
let locale;

// Gets filled with active locale translations
let translations = {};

// When the page content is ready...
document.addEventListener("DOMContentLoaded", () => {
    const requestedLocale = new URLSearchParams(window.location.search).get("lang");
    setLocale(isSupported(requestedLocale) ? requestedLocale : defaultLocale);
});


function isSupported(locale) {
    // Check if locale is supported
    return supportedLocales.indexOf(locale) > -1;
}

async function setLocale(newLocale) {
    // Load translations for the given locale and translate
    // the page to this locale
    if (newLocale === locale) return;
    if (!isSupported(newLocale)) {
        throw new RangeError(`Unsupported locale: ${newLocale}`);
    }

    NeonLogo.render(newLocale);

    const newTranslations = await fetchTranslationsFor(newLocale);
    locale = newLocale;
    translations = newTranslations;
    document.documentElement.lang = newLocale === "no" ? "nb" : "en";
    document.querySelectorAll(".language-switcher").forEach(button => {
        button.setAttribute("aria-pressed", String(
            button.getAttribute("i18n-aria-label") === `language-${newLocale === "no" ? "norwegian" : "english"}`
        ));
    });

    const pageUrl = new URL(window.location.href);
    if (newLocale === "en") {
        pageUrl.searchParams.set("lang", "en");
    } else {
        pageUrl.searchParams.delete("lang");
    }
    window.history.replaceState(null, "", `${pageUrl.pathname}${pageUrl.search}${pageUrl.hash}`);

    const canonicalUrl = `${pageUrl.origin}${pageUrl.pathname}${newLocale === "en" ? "?lang=en" : ""}`;
    document.querySelector('link[rel="canonical"]').setAttribute("href", canonicalUrl);
    document.querySelector('meta[property="og:url"]').setAttribute("content", canonicalUrl);

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
    document.querySelectorAll("[i18n-content]").forEach(element => {
        const key = element.getAttribute("i18n-content");
        const content = translations[key];
        if (typeof content !== "string") {
            console.error(`Missing translation for content: ${key}`);
            return;
        }
        element.setAttribute("content", content);
    });
    ["aria-label", "aria-roledescription"].forEach(attribute => {
        document.querySelectorAll(`[i18n-${attribute}]`).forEach(element => {
            const key = element.getAttribute(`i18n-${attribute}`);
            const label = translations[key];
            if (typeof label !== "string") {
                console.error(`Missing translation for ${attribute}: ${key}`);
                return;
            }
            element.setAttribute(attribute, label);
        });
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
