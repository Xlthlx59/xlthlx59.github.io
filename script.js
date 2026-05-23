const gallery = document.querySelector('.gallery');
const lightbox = document.querySelector('#lightbox');

if (gallery && lightbox) {
  const lightboxImg = lightbox.querySelector('img');
  const closeBtn = lightbox.querySelector('.lightbox-close');
  const prevBtn = lightbox.querySelector('.lightbox-nav.prev');
  const nextBtn = lightbox.querySelector('.lightbox-nav.next');

  const initialLoadCount = 12;
  const initialPriorityCount = 3;
  const loadBatchCount = 12;
  const backgroundLoadBatchCount = 6;
  const preloadMargin = '600px';

  const shuffle = (array) => {
    for (let index = array.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [array[index], array[randomIndex]] = [array[randomIndex], array[index]];
    }

    return array;
  };

  const getShotImage = (shot) => shot?.querySelector('img') || null;

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

  const waitForImages = (images, timeout) =>
    new Promise((resolve) => {
      const pendingImages = images.filter((img) => img && !img.complete);

      if (pendingImages.length === 0) {
        resolve();
        return;
      }

      const imagePromises = pendingImages.map(
        (img) =>
          new Promise((resolveImage) => {
            img.addEventListener('load', resolveImage, { once: true });
            img.addEventListener('error', resolveImage, { once: true });

            if (img.complete) {
              resolveImage();
            }
          }),
      );
      const timeoutPromise = new Promise((resolveTimeout) => {
        setTimeout(resolveTimeout, timeout);
      });

      Promise.race([Promise.all(imagePromises), timeoutPromise]).then(resolve);
    });

  const loadImage = (img) => {
    const source = img?.dataset.src;

    if (!source || img.dataset.loaded === 'true') {
      return;
    }

    img.src = source;
    img.dataset.loaded = 'true';
  };

  const loadShot = (shot) => {
    loadImage(getShotImage(shot));
  };

  const getLightboxSource = (shot) => {
    const img = getShotImage(shot);

    return img?.dataset.fullSrc || img?.dataset.src || img?.currentSrc || img?.src || '';
  };

  let shots = shuffle(Array.from(gallery.querySelectorAll('.shot')));
  const randomizedShots = document.createDocumentFragment();
  shots.forEach((shot) => randomizedShots.appendChild(shot));
  gallery.appendChild(randomizedShots);

  shots = getVisualOrder(Array.from(gallery.querySelectorAll('.shot')));

  let currentIndex = -1;
  let loadedUntilIndex = -1;
  let observer;

  const syncShotState = () => {
    shots.forEach((shot, index) => {
      const img = getShotImage(shot);
      const isInitialShot = index < initialLoadCount;
      const isPriorityShot = index < initialPriorityCount;

      shot.dataset.galleryIndex = String(index);

      if (img) {
        img.fetchPriority = isPriorityShot ? 'high' : 'low';
        img.loading = isInitialShot ? 'eager' : 'lazy';
        img.decoding = 'async';
      }
    });
  };

  const getShotIndex = (shot) => {
    const index = Number(shot?.dataset.galleryIndex);

    if (Number.isInteger(index) && shots[index] === shot) {
      return index;
    }

    return shots.indexOf(shot);
  };

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
    if (index < 0 || index >= shots.length) {
      return;
    }

    const shot = shots[index];
    const img = getShotImage(shot);
    const source = getLightboxSource(shot);

    if (!source) {
      return;
    }

    loadShot(shot);
    lightboxImg.src = source;
    lightboxImg.alt = img?.alt || '';
    currentIndex = index;
  };

  const openLightbox = (shot) => {
    const index = getShotIndex(shot);

    if (index === -1) {
      return;
    }

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
    if (shots.length === 0) {
      return;
    }

    updateLightbox((currentIndex + 1) % shots.length);
  };

  const showPrev = () => {
    if (shots.length === 0) {
      return;
    }

    updateLightbox((currentIndex - 1 + shots.length) % shots.length);
  };

  const getShotImages = (startIndex, endIndex) =>
    shots.slice(startIndex, endIndex + 1).map(getShotImage);

  const loadNextBackgroundBatch = () => {
    const startIndex = loadedUntilIndex + 1;

    if (startIndex >= shots.length) {
      return;
    }

    const endIndex = Math.min(startIndex + backgroundLoadBatchCount - 1, shots.length - 1);
    loadShotsThrough(endIndex);

    waitForImages(getShotImages(startIndex, endIndex), 2500).then(() => {
      setTimeout(loadNextBackgroundBatch, 400);
    });
  };

  const startBackgroundLoading = () => {
    waitForImages(getShotImages(0, initialLoadCount - 1), 6000).then(() => {
      setTimeout(loadNextBackgroundBatch, 400);
    });
  };

  syncShotState();
  loadShotsThrough(initialPriorityCount - 1);

  waitForImages(getShotImages(0, initialPriorityCount - 1), 1200).then(() => {
    loadShotsThrough(initialLoadCount - 1);
    startBackgroundLoading();
  });

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

  gallery.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) {
      return;
    }

    const trigger = event.target.closest('.shot-trigger');

    if (!trigger || !gallery.contains(trigger)) {
      return;
    }

    openLightbox(trigger.closest('.shot'));
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
}
