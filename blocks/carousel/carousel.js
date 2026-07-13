/*
 * Electronics Store Carousel
 * File: blocks/carousel/carousel.js
 */

export default function decorate(block) {
  const slides = [...block.children];

  if (!slides.length) return;

  const AUTOPLAY_DELAY = 3000;
  const hasMultipleSlides = slides.length > 1;

  let currentSlide = 0;
  let autoplayInterval;

  const slideContainer = document.createElement('div');
  slideContainer.className = 'carousel-slide-container';

  slides.forEach((slide, index) => {
    slide.classList.add('carousel-slide');
    slide.setAttribute('role', 'group');
    slide.setAttribute('aria-roledescription', 'slide');
    slide.setAttribute('aria-label', `${index + 1} of ${slides.length}`);

    slideContainer.append(slide);
  });

  const indicators = document.createElement('div');
  indicators.className = 'carousel-indicators';

  const dots = hasMultipleSlides
    ? slides.map((_, index) => {
        const dot = document.createElement('button');

        dot.type = 'button';
        dot.setAttribute('aria-label', `Go to slide ${index + 1}`);
        dot.setAttribute('aria-selected', index === 0 ? 'true' : 'false');

        dot.addEventListener('click', () => {
          goToSlide(index);
          restartAutoplay();
        });

        indicators.append(dot);

        return dot;
      })
    : [];

  function updateCarousel() {
    const slideWidth = slideContainer.offsetWidth;

    slideContainer.scrollTo({
      left: currentSlide * slideWidth,
      behavior: 'smooth',
    });

    dots.forEach((dot, index) => {
      dot.setAttribute(
        'aria-selected',
        index === currentSlide ? 'true' : 'false',
      );
    });
  }

  function goToSlide(index) {
    currentSlide = index;

    if (currentSlide < 0) {
      currentSlide = slides.length - 1;
    }

    if (currentSlide >= slides.length) {
      currentSlide = 0;
    }

    updateCarousel();
  }

  function stopAutoplay() {
    clearInterval(autoplayInterval);
  }

  function startAutoplay() {
    if (!hasMultipleSlides) return;

    stopAutoplay();

    autoplayInterval = setInterval(() => {
      goToSlide(currentSlide + 1);
    }, AUTOPLAY_DELAY);
  }

  function restartAutoplay() {
    stopAutoplay();
    startAutoplay();
  }

  block.addEventListener('mouseenter', stopAutoplay);
  block.addEventListener('mouseleave', startAutoplay);
  block.addEventListener('focusin', stopAutoplay);
  block.addEventListener('focusout', startAutoplay);

  block.setAttribute('tabindex', '0');
  block.setAttribute('role', 'region');
  block.setAttribute('aria-roledescription', 'carousel');
  block.setAttribute('aria-label', 'Featured products carousel');

  block.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') {
      goToSlide(currentSlide - 1);
      restartAutoplay();
    }

    if (event.key === 'ArrowRight') {
      goToSlide(currentSlide + 1);
      restartAutoplay();
    }
  });

  window.addEventListener('resize', updateCarousel);

  block.replaceChildren(slideContainer);

  if (hasMultipleSlides) {
    block.append(indicators);
    startAutoplay();
  }

  updateCarousel();
}