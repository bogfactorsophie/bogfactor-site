// Contact Form Modal
// Opens a contact form modal when the user clicks the Email/Contact link.
// Sends messages via a Cloudflare Worker + Resend.
(function () {
  const WORKER_URL = 'https://bog-contact.sophie-h-cole.workers.dev';

  function createModal() {
    const modal = document.createElement('div');
    modal.id = 'contact-modal';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content contact-modal-content">
        <button class="close-btn" aria-label="Close">&times;</button>
        <h3>Send us a message</h3>
        <form id="contact-form">
          <div class="contact-field">
            <label for="contact-name">Name</label>
            <input type="text" id="contact-name" name="name" required>
          </div>
          <div class="contact-field">
            <label for="contact-email">Email</label>
            <input type="email" id="contact-email" name="email" required>
          </div>
          <div class="contact-field">
            <label for="contact-message">Message</label>
            <textarea id="contact-message" name="message" rows="5" required></textarea>
          </div>
          <button type="submit" class="contact-submit-btn">Send</button>
          <p id="contact-status" class="contact-status"></p>
        </form>
      </div>
    `;
    document.body.appendChild(modal);

    // Close on X button
    modal.querySelector('.close-btn').addEventListener('click', function () {
      modal.style.display = 'none';
    });

    // Close on backdrop click
    modal.addEventListener('click', function (e) {
      if (e.target === modal) {
        modal.style.display = 'none';
      }
    });

    // Close on Escape key
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modal.style.display === 'flex') {
        modal.style.display = 'none';
      }
    });

    // Form submission
    var form = modal.querySelector('#contact-form');
    var status = modal.querySelector('#contact-status');
    var submitBtn = modal.querySelector('.contact-submit-btn');

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending...';
      status.textContent = '';
      status.className = 'contact-status';

      var data = Object.fromEntries(new FormData(form));

      try {
        var res = await fetch(WORKER_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });

        if (res.ok) {
          status.textContent = 'Message sent! We\'ll get back to you soon.';
          status.className = 'contact-status contact-status-success';
          form.reset();
        } else {
          status.textContent = 'Something went wrong. Please try again or email us directly.';
          status.className = 'contact-status contact-status-error';
        }
      } catch (err) {
        status.textContent = 'Could not send message. Please email hello@bogfactor.co.uk instead.';
        status.className = 'contact-status contact-status-error';
      }

      submitBtn.disabled = false;
      submitBtn.textContent = 'Send';
    });

    return modal;
  }

  document.addEventListener('DOMContentLoaded', function () {
    var modal = createModal();

    // Attach to all contact links (Email links in footer + Contact links)
    document.querySelectorAll('a[data-contact]').forEach(function (link) {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        modal.style.display = 'flex';
        modal.querySelector('#contact-name').focus();
      });
    });
  });
})();
