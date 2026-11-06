const tableBody = document.querySelector("#compatibility-rows");
const statusText = {
  en: { tested: "Tested", not_tested: "Not tested", unverified: "Not confirmed", empty: "No compatibility records are available." },
  fr: { tested: "Testé", not_tested: "Non testé", unverified: "Non confirmé", empty: "Aucun relevé de compatibilité disponible." }
};
const lang = document.documentElement.lang === "fr" ? "fr" : "en";

function hasDatedServerEvidence(record) {
  return record.status === "tested"
    && typeof record.server === "string"
    && record.server.trim().length > 0
    && typeof record.test_date === "string"
    && /^\d{4}-\d{2}-\d{2}$/.test(record.test_date);
}

function appendCell(row, value) {
  const cell = document.createElement("td");
  cell.textContent = value || "—";
  row.append(cell);
}

function render(records) {
  if (!tableBody) return;
  tableBody.replaceChildren();
  if (!Array.isArray(records) || records.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 5;
    cell.textContent = statusText[lang].empty;
    row.append(cell);
    tableBody.append(row);
    return;
  }
  for (const record of records) {
    const row = document.createElement("tr");
    const verified = hasDatedServerEvidence(record);
    const status = verified ? statusText[lang].tested
      : record.status === "not_tested" ? statusText[lang].not_tested
      : statusText[lang].unverified;
    appendCell(row, record.version);
    appendCell(row, verified ? record.server : "—");
    appendCell(row, verified ? record.test_date : "—");
    appendCell(row, status);
    appendCell(row, verified ? (Array.isArray(record.coverage) ? record.coverage.join(", ") : "") : record.note);
    tableBody.append(row);
  }
}

try {
  const response = await fetch(new URL("./compat.json", import.meta.url), { cache: "no-store" });
  if (!response.ok) throw new Error("compatibility data unavailable");
  const data = await response.json();
  render(data.records);
} catch {
  render([]);
}
