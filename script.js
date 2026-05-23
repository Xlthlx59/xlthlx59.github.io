const gallery = document.querySelector('.gallery');
const lightbox = document.querySelector('#lightbox');
const lightboxImg = lightbox.querySelector('img');
const closeBtn = lightbox.querySelector('.lightbox-close');
const prevBtn = lightbox.querySelector('.lightbox-nav.prev');
const nextBtn = lightbox.querySelector('.lightbox-nav.next');

const preloadCount = 6;
const preloadMargin = '600px';

const shuffle = (array) => {
  for (let index = array.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [array[index], array[randomIndex]] = [array[randomIndex], array[index]];
  }
  return array;
};

const loadImage = (img) => {
  const source = img.dataset.src;
  if (!source || img.dataset.loaded === 'true') {
    return;
  }

  img.src = source;
  img.dataset.loaded = 'true';
};

let shots = Array.from(gallery.querySelectorAll('.shot'));
shots = shuffle(shots);
shots.forEach((shot) => gallery.appendChild(shot));

shots.forEach((shot, index) => {
  const trigger = shot.querySelector('.shot-trigger');
  const img = shot.querySelector('img');

  trigger.addEventListener('click', () => openLightbox(index));

  if (index < preloadCount) {
    img.fetchPriority = 'high';
    loadImage(img);
  } else {
    img.fetchPriority = 'low';
    img.decoding = 'async';
  }
});

window.addEventListener('load', () => {
  shots.slice(0, preloadCount).forEach((shot) => {
    const img = shot.querySelector('img');
    loadImage(img);
  });
});

if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) {
          continue;
        }

        loadImage(entry.target);
        observer.unobserve(entry.target);
      }
    },
    {
      rootMargin: preloadMargin,
    },
  );

  shots.slice(preloadCount).forEach((shot) => {
    const img = shot.querySelector('img');
    observer.observe(img);
  });
} else {
  shots.slice(preloadCount).forEach((shot) => {
    const img = shot.querySelector('img');
    loadImage(img);
  });
}

let currentIndex = 0;

const updateLightbox = (index) => {
  const shot = shots[index];
  const img = shot.querySelector('img');
  const source = img.dataset.src || img.src;

  lightboxImg.src = source;
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
