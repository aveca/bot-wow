/**
 * Payment Links du compte BOT-WOW acct_1UZwjERnrMmUAHDt.
 * Laisser vide tant que le propriétaire n'a pas collé l'URL créée dans Stripe.
 * Le lien historique de réservation bêta est refusé.
 */
export const RETIRED_PAYMENT_LINK = "https://buy.stripe.com/00wbJ3gHAdHEf78fF863K00";
export const PAYMENT_LINKS = {
  planner: "https://buy.stripe.com/4gM4gB62W4749MO78C63K01",
  studio: "https://buy.stripe.com/eVqdRb8b4dHE6AC50u63K02"
};

const links = { planner: PAYMENT_LINKS.planner, studio: PAYMENT_LINKS.studio };

function usable(url) {
  return typeof url === "string" && url.startsWith("https://buy.stripe.com/") && url !== RETIRED_PAYMENT_LINK;
}

async function loadRemote() {
  try {
    const res = await fetch("https://api.bot-wow.com/api/config");
    if (!res.ok) return;
    const body = await res.json();
    for (const offer of body.offers || []) {
      if (offer && usable(offer.url)) links[offer.priceKey] = offer.url;
    }
  } catch (e) { /* l'API ancienne n'a pas offers */ }
}

function bind() {
  const note = document.getElementById("pay-note");
  for (const el of document.querySelectorAll("[data-price-key]")) {
    const key = el.getAttribute("data-price-key");
    const url = links[key];
    if (usable(url)) {
      el.setAttribute("href", url);
      continue;
    }
    el.addEventListener("click", (ev) => {
      ev.preventDefault();
      if (note) note.textContent = "The Stripe Payment Link for this offer is not published yet. No charge was started.";
    });
  }
}

loadRemote().then(bind);
