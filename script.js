const gallery = document.querySelector('.gallery');
const lightbox = document.querySelector('#lightbox');
const lightboxImg = lightbox.querySelector('img');
const closeBtn = lightbox.querySelector('.lightbox-close');
const prevBtn = lightbox.querySelector('.lightbox-nav.prev');
const nextBtn = lightbox.querySelector('.lightbox-nav.next');

const shuffle = (array) => {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

let shots = Array.from(gallery.querySelectorAll('.shot'));
shots = shuffle(shots);
shots.forEach((shot) => gallery.appendChild(shot));

let currentIndex = 0;

const updateLightbox = (index) => {
  const shot = shots[index];
  const img = shot.querySelector('img');
  lightboxImg.src = img.src;
  lightboxImg.alt = img.alt || '';

  currentIndex = index;
};

const openLightbox = (index) => {
  updateLightbox(index);
  lightbox.classList.add('open');
  lightbox.setAttribute('aria-hidden', 'false');
  document.body.classList.add('no-scroll');
};

const closeLightbox = () => {
  lightbox.classList.remove('open');
  lightbox.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('no-scroll');
};

const showNext = () => {
  const nextIndex = (currentIndex + 1) % shots.length;
  updateLightbox(nextIndex);
};

const showPrev = () => {
  const prevIndex = (currentIndex - 1 + shots.length) % shots.length;
  updateLightbox(prevIndex);
};

shots.forEach((shot, index) => {
  const trigger = shot.querySelector('.shot-trigger');
  trigger.addEventListener('click', () => openLightbox(index));
});

closeBtn.addEventListener('click', closeLightbox);
nextBtn.addEventListener('click', showNext);
prevBtn.addEventListener('click', showPrev);

lightbox.addEventListener('click', (event) => {
  if (event.target === lightbox) {
    closeLightbox();
  }
});

window.addEventListener('keydown', (event) => {
  if (!lightbox.classList.contains('open')) {
    return;
  }

  if (event.key === 'Escape') {
    closeLightbox();
  }

  if (event.key === 'ArrowRight') {
    showNext();
  }

  if (event.key === 'ArrowLeft') {
    showPrev();
  }
});
