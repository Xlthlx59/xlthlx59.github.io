const gallery = document.querySelector('.gallery');
const lightbox = document.querySelector('#lightbox');
const lightboxImg = lightbox.querySelector('img');
const closeBtn = lightbox.querySelector('.lightbox-close');
const prevBtn = lightbox.querySelector('.lightbox-nav.prev');
const nextBtn = lightbox.querySelector('.lightbox-nav.next');

const initialLoadCount = 12;
const loadBatchCount = 12;
const preloadMargin = '600px';

const shuffle = (array) => {
  for (let index = array.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [array[index], array[randomIndex]] = [array[randomIndex], array[index]];
  }
  return array;
};

const loadImage = (img) => {
  if (!img) {
    return;
  }

  const source = img.dataset.src;
  if (!source || img.dataset.loaded === 'true') {
    return;
  }

  img.src = source;
  img.dataset.loaded = 'true';
};

const loadShot = (shot) => {
  loadImage(shot.querySelector('img'));
};

const getVisualOrder = (items) =>
  items
    .map((shot, fallbackIndex) => {
      const rect = shot.getBoundingClientRect();

      return {
        shot,
        fallbackIndex,
        top: rect.top + window.scrollY,
        left: rect.left + window.scrollX,
      };
    })
    .sort((first, second) => {
      if (first.top !== second.top) {
        return first.top - second.top;
      }

      if (first.left !== second.left) {
        return first.left - second.left;
      }

      return first.fallbackIndex - second.fallbackIndex;
    })
    .map(({ shot }) => shot);

let shots = Array.from(gallery.querySelectorAll('.shot'));
shots = shuffle(shots);
const randomizedShots = document.createDocumentFragment();
shots.forEach((shot) => randomizedShots.appendChild(shot));
gallery.appendChild(randomizedShots);
shots = getVisualOrder(shots);

let currentIndex = 0;
let loadedUntilIndex = -1;
let observer;

const loadShotsThrough = (targetIndex) => {
  const nextLoadedUntilIndex = Math.min(targetIndex, shots.length - 1);

  if (nextLoadedUntilIndex <= loadedUntilIndex) {
    return;
  }

  for (let index = loadedUntilIndex + 1; index <= nextLoadedUntilIndex; index += 1) {
    loadShot(shots[index]);

    if (observer) {
      observer.unobserve(shots[index]);
    }
  }

  loadedUntilIndex = nextLoadedUntilIndex;
};

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

shots.forEach((shot, index) => {
  const trigger = shot.querySelector('.shot-trigger');
  const img = shot.querySelector('img');
  const isInitialShot = index < initialLoadCount;

  shot.dataset.galleryIndex = String(index);
  trigger.addEventListener('click', () => openLightbox(index));
  img.fetchPriority = isInitialShot ? 'high' : 'low';
  img.loading = isInitialShot ? 'eager' : 'lazy';
  img.decoding = 'async';
});

loadShotsThrough(initialLoadCount - 1);

if ('IntersectionObserver' in window) {
  observer = new IntersectionObserver(
    (entries) => {
      let farthestVisibleIndex = -1;

      for (const entry of entries) {
        if (!entry.isIntersecting) {
          continue;
        }

        const index = Number(entry.target.dataset.galleryIndex);

        if (Number.isFinite(index)) {
          farthestVisibleIndex = Math.max(farthestVisibleIndex, index);
        }
      }

      if (farthestVisibleIndex === -1) {
        return;
      }

      loadShotsThrough(farthestVisibleIndex + loadBatchCount - 1);
    },
    {
      rootMargin: preloadMargin,
    },
  );

  shots.slice(initialLoadCount).forEach((shot) => {
    observer.observe(shot);
  });
} else {
  loadShotsThrough(shots.length - 1);
}

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
