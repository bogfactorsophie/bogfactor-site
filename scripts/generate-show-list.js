// Modal functions
function openModal(modalId) {
  document.getElementById(modalId).style.display = 'block';
}

function closeModal(modalId) {
  document.getElementById(modalId).style.display = 'none';
}

// Close modal when clicking outside of it
window.onclick = function (event) {
  if (event.target.classList.contains('modal')) {
    event.target.style.display = 'none';
  }
};

// Close modal when pressing Escape key
document.addEventListener('keydown', function (event) {
  if (event.key === 'Escape' || event.key === 'Esc') {
    const openModal = document.querySelector('.modal[style*="display: block"]');
    if (openModal) {
      openModal.style.display = 'none';
    }
  }
});

// Generate shows from JSON
window.loadShows = async function () {
  try {
    const response = await fetch('shows.json');
    const shows = await response.json();

    const container = document.getElementById('shows-container');

    shows.forEach((show) => {
      // Create show textbox
      const showDiv = document.createElement('div');
      showDiv.className = 'textbox';
      showDiv.id = show.id; // Add ID for anchor links

      const title = document.createElement('h2');
      title.className = 'show-title';

      // Make title a clickable anchor link
      const titleLink = document.createElement('a');
      titleLink.href = `#${show.id}`;
      titleLink.textContent = show.title;
      titleLink.className = 'show-title-link';
      titleLink.onclick = (e) => {
        e.preventDefault();
        const toolbar = document.querySelector('.toolbar');
        const toolbarHeight = toolbar ? toolbar.offsetHeight : 0;
        const targetPosition =
          showDiv.getBoundingClientRect().top + window.pageYOffset - toolbarHeight - 20;
        window.scrollTo({ top: targetPosition, behavior: 'smooth' });
        // Update URL without triggering scroll
        history.pushState(null, null, `#${show.id}`);
      };

      // Add copy link button
      const linkIcon = document.createElement('button');
      linkIcon.className = 'copy-link-btn';
      linkIcon.innerHTML = '🔗';
      linkIcon.title = 'Copy link to this show';
      linkIcon.onclick = (e) => {
        e.preventDefault();
        const url = `${window.location.origin}${window.location.pathname}#${show.id}`;
        navigator.clipboard
          .writeText(url)
          .then(() => {
            linkIcon.innerHTML = '✓';
            setTimeout(() => (linkIcon.innerHTML = '🔗'), 2000);
          })
          .catch(() => {
            // Fallback for older browsers
            linkIcon.innerHTML = '🔗';
          });
      };

      title.appendChild(titleLink);
      title.appendChild(linkIcon);

      const description = document.createElement('p');
      description.textContent = show.description;

      showDiv.appendChild(title);
      showDiv.appendChild(description);

      // Add image if present
      if (show.image) {
        const imageContainer = document.createElement('div');
        imageContainer.className = 'show-image-container';

        const img = document.createElement('img');
        img.src = show.image;
        img.alt = show.title;
        img.className = 'show-image';
        img.loading = 'lazy'; // Lazy load images for performance

        imageContainer.appendChild(img);
        showDiv.appendChild(imageContainer);
      }

      const buttonContainer = document.createElement('div');
      buttonContainer.className = 'button-container';

      const playButton = document.createElement('button');
      playButton.className = 'play-btn';
      playButton.textContent = '▶ Play';
      playButton.onclick = () => {
        if (window.BogFactorPlayer) {
          window.BogFactorPlayer.playTrack(show.mixcloudPath, show.title);
        }
      };

      const tracklistButton = document.createElement('button');
      tracklistButton.className = 'tracklist-btn';
      tracklistButton.textContent = 'View Tracklist';
      tracklistButton.onclick = () => openModal(`modal-${show.id}`);

      buttonContainer.appendChild(playButton);
      buttonContainer.appendChild(tracklistButton);

      showDiv.appendChild(buttonContainer);

      // Create modal
      const modal = document.createElement('div');
      modal.id = `modal-${show.id}`;
      modal.className = 'modal';

      const modalContent = document.createElement('div');
      modalContent.className = 'modal-content';

      const closeBtn = document.createElement('button');
      closeBtn.className = 'close-btn';
      closeBtn.innerHTML = '&times;';
      closeBtn.onclick = () => closeModal(`modal-${show.id}`);

      const modalTitle = document.createElement('h3');
      modalTitle.textContent = `${show.title} Tracklist`;

      const tracklistContent = document.createElement('div');
      tracklistContent.className = 'tracklist-content';

      if (show.tracklist && show.tracklist.length > 0) {
        const ul = document.createElement('ul');
        show.tracklist.forEach((track) => {
          const li = document.createElement('li');
          li.className = 'tracklist-item';

          const trackText = document.createElement('span');
          trackText.className = 'track-text';
          trackText.textContent = track;

          const youtubeBtn = document.createElement('a');
          youtubeBtn.className = 'youtube-search-btn';
          youtubeBtn.innerHTML = '🔍';
          youtubeBtn.title = `Search "${track}" on YouTube`;
          youtubeBtn.href = `https://www.youtube.com/results?search_query=${encodeURIComponent(
            track
          )}`;
          youtubeBtn.target = '_blank';
          youtubeBtn.rel = 'noopener noreferrer';

          li.appendChild(trackText);
          li.appendChild(youtubeBtn);
          ul.appendChild(li);
        });
        tracklistContent.appendChild(ul);
      } else {
        const placeholder = document.createElement('p');
        placeholder.textContent = 'Tracklist coming soon...';
        tracklistContent.appendChild(placeholder);
      }

      modalContent.appendChild(closeBtn);
      modalContent.appendChild(modalTitle);
      modalContent.appendChild(tracklistContent);
      modal.appendChild(modalContent);

      // Append to container
      container.appendChild(showDiv);
      container.appendChild(modal);
    });
  } catch (error) {
    console.error('Error loading shows:', error);
    document.getElementById('shows-container').innerHTML =
      '<p>Error loading shows. Please try again later.</p>';
  }
};

// Load shows when page loads
loadShows().then(() => {
  // If there's a hash in the URL, scroll to it with offset for toolbar
  if (window.location.hash) {
    const target = document.querySelector(window.location.hash);
    if (target) {
      setTimeout(() => {
        const toolbar = document.querySelector('.toolbar');
        const toolbarHeight = toolbar ? toolbar.offsetHeight : 0;
        const targetPosition =
          target.getBoundingClientRect().top + window.pageYOffset - toolbarHeight - 20;
        window.scrollTo({ top: targetPosition, behavior: 'smooth' });
      }, 100);
    }
  }
});