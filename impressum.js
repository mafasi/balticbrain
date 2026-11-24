/* The public IGD document URL from the Fraunhofer DSI generator is configured
   in impressum.html. The institutional source link also works without JS. */
document.getElementById('copyright-year').textContent = new Date().getFullYear();

(async () => {
  const content = document.getElementById('impressum-content');
  const configuredUrl = content.dataset.imprintUrl.trim();
  if (!configuredUrl) return;

  const sourceLink = document.getElementById('impressum-source');
  let source;
  try {
    source = new URL(configuredUrl);
    if (source.protocol !== 'https:' || source.host !== 'dsi-generator.fraunhofer.de'
        || source.username || source.password
        || !source.pathname.startsWith('/impressum/impressum_view/de/')) return;
  } catch {
    return;
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 12000);
  content.setAttribute('aria-busy', 'true');
  try {
    const response = await fetch(source.href, {
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!response.ok) throw new Error('Imprint request failed.');

    const documentSource = new DOMParser().parseFromString(await response.text(), 'text/html');
    const generatedDocument = documentSource.getElementById('generated-document');
    // A public generator example may belong to another institute. Keep the IGD
    // fallback instead of showing an unrelated institute's legal information.
    const hasInstitute = generatedDocument && [...generatedDocument.querySelectorAll('p')]
      .some((paragraph) => /\bIGD\b/i.test(paragraph.textContent));
    if (!hasInstitute) {
      throw new Error('The document is not an IGD imprint.');
    }

    generatedDocument.querySelectorAll('script, style, iframe, object, embed, link, meta, base, form, input, button, img, svg, math, template').forEach((element) => element.remove());
    for (const element of [generatedDocument, ...generatedDocument.querySelectorAll('*')]) {
      const href = element.tagName === 'A' ? element.getAttribute('href') : null;
      for (const attribute of [...element.attributes]) element.removeAttribute(attribute.name);
      if (href) {
        try {
          const link = new URL(href, source.href);
          if (['https:', 'http:', 'mailto:', 'tel:'].includes(link.protocol)) {
            element.setAttribute('href', link.href);
          }
        } catch { /* Keep the text when a link cannot be resolved. */ }
      }
    }

    const firstHeading = generatedDocument.querySelector('h2');
    if (firstHeading?.textContent.trim() === 'Impressum') firstHeading.remove();
    content.replaceChildren(document.importNode(generatedDocument, true));
    sourceLink.href = source.href;
  } catch {
    // The existing paragraph and institutional source link remain available
    // for network/CORS failures, timeouts, and unexpected response content.
  } finally {
    window.clearTimeout(timeout);
    content.removeAttribute('aria-busy');
  }
})();
