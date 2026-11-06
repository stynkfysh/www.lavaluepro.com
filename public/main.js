/* LA Value Pro — navigation and request forms */
(function () {
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('site-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  var forms = document.querySelectorAll('form[data-form]');
  if (!forms.length) return;

  var token = '';
  function fetchToken() {
    return fetch('/api/form-token', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : {}; })
      .then(function (d) { token = d.token || ''; })
      .catch(function () { token = ''; });
  }
  fetchToken();

  // Pre-fill the city from ?city= (links on area pages) and show the date field label by purpose.
  var params = new URLSearchParams(window.location.search);
  var cityParam = params.get('city');
  var cityInput = document.getElementById('city');
  if (cityParam && cityInput && !cityInput.value) cityInput.value = cityParam;
  var purposeParam = params.get('purpose');
  var purposeSel = document.getElementById('purpose');
  if (purposeParam && purposeSel) {
    for (var i = 0; i < purposeSel.options.length; i++) {
      if (purposeSel.options[i].value === purposeParam) { purposeSel.selectedIndex = i; break; }
    }
  }
  var dateLabel = document.getElementById('effective-date-label');
  function syncDateLabel() {
    if (!purposeSel || !dateLabel) return;
    var v = purposeSel.value;
    var deathish = ['date-of-death', 'step-up', 'trust', 'estate', 'prop-19'].indexOf(v) > -1;
    dateLabel.firstChild.nodeValue = deathish ? 'Date of death ' : (v === 'divorce' ? 'Date of separation (if needed) ' : 'Effective date ');
  }
  if (purposeSel) { purposeSel.addEventListener('change', syncDateLabel); syncDateLabel(); }

  forms.forEach(function (form) {
    var started = Date.now();
    var status = form.querySelector('.form-status');
    var button = form.querySelector('button[type=submit]');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.reportValidity()) return;
      var data = {};
      new FormData(form).forEach(function (v, k) { data[k] = typeof v === 'string' ? v.trim() : v; });
      data.formType = form.getAttribute('data-form');
      data._ts = String(started);
      data._token = token;
      data.page = window.location.pathname;
      button.disabled = true;
      var label = button.textContent;
      button.textContent = 'Sending…';
      status.textContent = '';
      status.className = 'form-status';
      fetch('/api/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, body: j }; }); })
        .then(function (res) {
          if (!res.ok || !res.body.success) throw new Error(res.body.error || 'The request was not sent.');
          var done = document.createElement('div');
          done.className = 'form-done';
          done.setAttribute('role', 'status');
          done.setAttribute('tabindex', '-1');
          done.innerHTML = form.getAttribute('data-form') === 'order'
            ? '<h2>Request received</h2><p>Brian will review the property and email a confirmation and secure invoice within one business day. A copy of your request is on its way to your inbox.</p>'
            : '<h2>Message received</h2><p>We will reply by email within one business day. A copy of your message is on its way to your inbox.</p>';
          form.replaceWith(done);
          done.focus();
        })
        .catch(function (err) {
          status.textContent = err.message + ' Please try again, or email contact@lavaluepro.com.';
          status.className = 'form-status error';
          button.disabled = false;
          button.textContent = label;
          fetchToken();
        });
    });
  });
})();
