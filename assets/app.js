/**
 * Factory V3 — bot-wow signup (2026-10-18)
 * Parcours d'inscription honnête :
 *  - succès UNIQUEMENT sur réponse 2xx réelle de l'API ;
 *  - endpoint configurable via data-api-base sur le formulaire ;
 *  - API absente (404), erreur 5xx ou réseau -> message d'indisponibilité.
 *    Aucun faux succès : une inscription n'est "enregistrée" que si l'API
 *    l'a confirmée.
 */
(function () {
  "use strict";

  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  // Pure + exporté pour les tests (window.__botwowSignup).
  function validateSignup(email, consent) {
    var e = String(email || "").trim();
    if (!e) return { ok: false, reason: "empty_email" };
    if (!EMAIL_RE.test(e)) return { ok: false, reason: "invalid_email" };
    if (!consent) return { ok: false, reason: "missing_consent" };
    return { ok: true, email: e };
  }

  function setMessage(el, text, kind) {
    if (!el) return;
    el.textContent = text;
    el.dataset.kind = kind || "info";
  }

  function wireSignup(doc) {
    var form = doc.getElementById("signup-form");
    if (!form) return;

    var input = doc.getElementById("signup-email");
    var consent = doc.getElementById("signup-consent");
    var status = doc.getElementById("signup-status");
    var submit = form.querySelector("button[type=submit]");
    // Endpoint configurable sans toucher au code : data-api-base sur le form.
    var apiBase = (form.getAttribute("data-api-base") || "").replace(/\/+$/, "");
    var endpoint = apiBase + "/api/subscribe";

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var check = validateSignup(input && input.value, consent && consent.checked);
      if (!check.ok) {
        var reasons = {
          empty_email: "Entre ton adresse e-mail.",
          invalid_email: "Cette adresse e-mail ne semble pas valide.",
          missing_consent: "Coche la case de consentement pour continuer.",
        };
        setMessage(status, reasons[check.reason], "error");
        return;
      }

      if (submit) {
        submit.disabled = true;
        submit.textContent = "Inscription en cours…";
      }
      setMessage(status, "Envoi en cours…", "info");

      fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: check.email,
          source: "botwow_site_signup",
          consent_marketing: true,
          consent_transactional: true,
        }),
      })
        .then(function (resp) {
          if (resp.ok) {
            // Succès UNIQUEMENT après confirmation réelle de l'API.
            setMessage(
              status,
              "Inscription confirmée. Vérifie ta boîte mail.",
              "success"
            );
            if (input) input.value = "";
            if (consent) consent.checked = false;
          } else if (resp.status === 404 || resp.status === 501) {
            setMessage(
              status,
              "L'inscription en ligne n'est pas encore ouverte. "
                + "Réessaie plus tard — rien n'a été enregistré.",
              "error"
            );
          } else if (resp.status === 409) {
            setMessage(status, "Cette adresse est déjà inscrite.", "info");
          } else {
            setMessage(
              status,
              "Une erreur est survenue côté serveur. Rien n'a été enregistré.",
              "error"
            );
          }
        })
        .catch(function () {
          setMessage(
            status,
            "Connexion impossible. Rien n'a été enregistré — réessaie plus tard.",
            "error"
          );
        })
        .finally(function () {
          if (submit) {
            submit.disabled = false;
            submit.textContent = "M'inscrire à la beta";
          }
        });
    });
  }

  window.__botwowSignup = { validateSignup: validateSignup, wireSignup: wireSignup };
  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", function () {
        wireSignup(document);
      });
    } else {
      wireSignup(document);
    }
  }
})();
