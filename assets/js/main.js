/* Andersons Plumbing Co — shared behaviour.
   ONE swappable business-name constant: change this value and every
   dynamic string (bot header, confirmations) follows it. Static page
   copy uses the same name throughout. */
const BUSINESS_NAME = "Andersons Plumbing Co";
const BUSINESS_PHONE = "069 121 4545";
const BUSINESS_PHONE_TEL = "tel:0691214545";
const BUSINESS_EMAIL = "jw.andersonsplumbing@gmail.com";

document.addEventListener("DOMContentLoaded", () => {
  document.documentElement.classList.add("js");
  /* Mobile nav toggle */
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.getElementById("main-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", () => {
      const open = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    nav.querySelectorAll("a").forEach(a =>
      a.addEventListener("click", () => nav.classList.remove("open")));
  }

  /* Scroll reveal (content stays visible if JS fails: hiding only applies under .js).
     Safety timer: reveal everything after 2.5s even if the observer never fires,
     so content can never stay invisible (and full-page captures show it). */
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
  }, { threshold: 0.12, rootMargin: "0px 0px 200px 0px" });
  document.querySelectorAll(".reveal").forEach(el => io.observe(el));
  setTimeout(() => document.querySelectorAll(".reveal:not(.in)").forEach(el => el.classList.add("in")), 2500);

  /* Footer year — always the current year */
  document.querySelectorAll("[data-year]").forEach(el => { el.textContent = new Date().getFullYear(); });

  initContactForm();
  initBot();
});

/* ---------------- Contact / quote form ---------------- */
function initContactForm() {
  const form = document.getElementById("quote-form");
  if (!form) return;
  const radios = form.querySelectorAll('input[name="request-type"]');
  const submit = form.querySelector('button[type="submit"]');
  const priorityNote = document.getElementById("priority-note");
  const LABELS = {
    emergency: "SEND EMERGENCY REQUEST — QUOTE AFTER DIAGNOSIS",
    scheduled: "SEND REQUEST — QUOTE AFTER DIAGNOSIS"
  };
  function sync() {
    const type = form.querySelector('input[name="request-type"]:checked').value;
    submit.textContent = LABELS[type];
    document.querySelectorAll(".radio-card").forEach(card => {
      const input = card.querySelector("input");
      card.classList.toggle("selected-emergency", input.checked && input.value === "emergency");
      card.classList.toggle("selected-scheduled", input.checked && input.value === "scheduled");
    });
    if (priorityNote) {
      priorityNote.textContent = type === "emergency"
        ? "Emergency request — we treat this as urgent. Call " + BUSINESS_PHONE + " for the fastest response."
        : "Scheduled visit — we will call or message you back to arrange a time.";
    }
  }
  radios.forEach(r => r.addEventListener("change", sync));
  sync();

  form.addEventListener("submit", e => {
    e.preventDefault();
    if (!form.checkValidity()) { form.reportValidity(); return; }
    const type = form.querySelector('input[name="request-type"]:checked').value;
    const name = form.querySelector("#f-name").value.trim();
    const success = document.getElementById("form-success");
    const successText = document.getElementById("form-success-text");
    if (successText) {
      successText.textContent = "Thank you, " + name + ". Your " +
        (type === "emergency" ? "emergency" : "scheduled") +
        " request has been received. We will call or message you back. Quote after diagnosis.";
    }
    form.hidden = true;
    if (success) success.hidden = false;
    if (success) success.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

/* ---------------- WhatsApp bot (state machine) ----------------
   Steps: 1 Emergency? → 2 Problem → 3 Suburb (free text) → 4 Photo (optional/skip) → 5 Visit booked.
   Two paths: emergency (priority wording + call escape) and scheduled. */
function initBot() {
  const chat = document.getElementById("bot-chat");
  if (!chat) return;
  const inputRow = document.getElementById("bot-input-row");
  const freeInput = document.getElementById("bot-free-input");
  const sendBtn = document.getElementById("bot-send");

  const state = { emergency: null, problem: "", suburb: "", photo: "Skipped — no photo sent" };
  const PROBLEMS = ["Burst pipe","Major leak","Overflowing toilet","Blocked drain","No hot water","Leaking tap","New installation","Other"];

  const now = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const scrollChat = () => { chat.scrollTop = chat.scrollHeight; };

  function bubble(text, who) {
    const d = document.createElement("div");
    d.className = "bubble " + who;
    d.innerHTML = "";
    d.appendChild(document.createTextNode(text));
    const t = document.createElement("span");
    t.className = "time"; t.textContent = now();
    d.appendChild(t);
    chat.appendChild(d); scrollChat();
    return d;
  }
  function typingBubble() {
    const d = document.createElement("div");
    d.className = "bubble bot typing";
    d.setAttribute("aria-label", "typing");
    d.innerHTML = "<i></i><i></i><i></i>";
    chat.appendChild(d); scrollChat();
    return d;
  }
  function botSay(text, delay) {
    return new Promise(resolve => {
      const t = typingBubble();
      setTimeout(() => { t.remove(); bubble(text, "bot"); resolve(); }, delay || 850);
    });
  }
  function actionRow() {
    const row = document.createElement("div");
    row.className = "bot-actions";
    chat.appendChild(row); scrollChat();
    return row;
  }
  function chipBtn(label, cls, onClick) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "chip" + (cls ? " " + cls : "");
    b.textContent = label;
    b.addEventListener("click", onClick);
    return b;
  }
  function lockRow(row) { row.querySelectorAll("button, input").forEach(el => { el.disabled = true; }); }

  async function stepEmergency() {
    await botSay("Hi! I'm the " + BUSINESS_NAME + " assistant. Is this an emergency?");
    const row = actionRow();
    const yes = chipBtn("YES — IT'S AN EMERGENCY", "emergency wide", () => {
      lockRow(row); bubble("Yes — it's an emergency", "user"); state.emergency = true; stepProblem(true);
    });
    const no = chipBtn("NO — IT'S NOT URGENT", "wide", () => {
      lockRow(row); bubble("No — it's not urgent", "user"); state.emergency = false; stepProblem(false);
    });
    row.append(yes, no);
  }

  async function stepProblem(isEmergency) {
    await botSay(isEmergency
      ? "Got it — let's get you help fast. What's the problem? If water is spreading, call " + BUSINESS_PHONE + " now."
      : "No problem — let's book a scheduled visit. What's the problem?");
    const row = actionRow();
    const chips = document.createElement("div");
    chips.className = "chip-row";
    PROBLEMS.forEach(p => {
      chips.appendChild(chipBtn(p.toUpperCase(), "", () => {
        lockRow(row); bubble(p, "user"); state.problem = p; stepSuburb();
      }));
    });
    row.appendChild(chips);
  }

  async function stepSuburb() {
    await botSay("Which suburb are you in? Type it below — we'll confirm we cover your area.");
    const row = actionRow();
    const input = document.createElement("input");
    input.type = "text"; input.placeholder = "Type your suburb…";
    input.setAttribute("aria-label", "Your suburb");
    input.style.cssText = "width:100%;border:2px solid #128C7E;border-radius:22px;padding:11px 15px;font-size:15px;font-family:inherit";
    const go = document.createElement("button");
    go.type = "button"; go.className = "btn btn-wa btn-sm btn-block"; go.textContent = "CONTINUE";
    go.addEventListener("click", () => {
      const v = input.value.trim();
      if (!v) { input.focus(); input.placeholder = "Please type your suburb to continue…"; return; }
      lockRow(row); bubble(v, "user"); state.suburb = v; stepPhoto();
    });
    input.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); go.click(); } });
    row.append(input, go);
    input.focus();
  }

  async function stepPhoto() {
    await botSay("Can you send a photo of the problem? It helps us bring the right parts. This step is optional.");
    const row = actionRow();
    const fileBtn = document.createElement("label");
    fileBtn.className = "btn btn-navy btn-sm btn-block";
    fileBtn.style.cursor = "pointer";
    fileBtn.textContent = "SEND A PHOTO";
    const fileInput = document.createElement("input");
    fileInput.type = "file"; fileInput.accept = "image/*"; fileInput.hidden = true;
    fileInput.setAttribute("aria-label", "Send a photo of the problem (optional)");
    fileBtn.appendChild(fileInput);
    fileInput.addEventListener("change", () => {
      const f = fileInput.files && fileInput.files[0];
      if (!f) return;
      lockRow(row); bubble("Photo sent: " + f.name, "user");
      state.photo = "Photo sent (" + f.name + ")";
      const reader = new FileReader();
      reader.onload = e => {
        const img = document.createElement("img");
        img.src = e.target.result; img.alt = "Photo of the problem you sent"; img.className = "photo-preview";
        chat.appendChild(img); scrollChat();
      };
      reader.readAsDataURL(f);
      stepBooked();
    });
    const skip = document.createElement("button");
    skip.type = "button"; skip.className = "btn btn-outline btn-sm btn-block"; skip.textContent = "SKIP PHOTO";
    skip.addEventListener("click", () => {
      lockRow(row); bubble("Skip photo", "user"); state.photo = "Skipped — no photo sent"; stepBooked();
    });
    row.append(fileBtn, skip);
  }

  async function stepBooked() {
    await botSay(state.emergency
      ? "Visit booked — a PIRB-registered plumber is on the way. We'll confirm your time slot by WhatsApp."
      : "Visit booked — we'll confirm your scheduled time slot by WhatsApp.");
    const wrap = document.createElement("div");
    wrap.className = "bot-summary";
    wrap.innerHTML = "";
    const dl = document.createElement("dl");
    const rows = [
      ["Request", state.emergency ? "Emergency" : "Scheduled visit"],
      ["Problem", state.problem],
      ["Suburb", state.suburb],
      ["Photo", state.photo],
      ["Quote", "Quote after diagnosis"]
    ];
    rows.forEach(([k, v]) => {
      const dt = document.createElement("dt"); dt.textContent = k;
      const dd = document.createElement("dd"); dd.textContent = v;
      dl.append(dt, dd);
    });
    wrap.appendChild(dl);
    chat.appendChild(wrap); scrollChat();
    await botSay("Quote after diagnosis — no price before we see the job.");
    const row = actionRow();
    const call = document.createElement("a");
    call.className = "btn btn-red btn-sm btn-block"; call.href = BUSINESS_PHONE_TEL;
    call.textContent = "CALL NOW — " + BUSINESS_PHONE;
    const again = document.createElement("button");
    again.type = "button"; again.className = "btn btn-outline btn-sm btn-block"; again.textContent = "START AGAIN";
    again.addEventListener("click", () => { chat.innerHTML = ""; start(); });
    row.append(call, again);
    if (inputRow) inputRow.hidden = true;
  }

  function start() {
    const params = new URLSearchParams(window.location.search);
    const pre = params.get("emergency");
    if (pre === "yes" || pre === "no") {
      state.emergency = pre === "yes";
      bubble(state.emergency ? "Yes — it's an emergency" : "No — it's not urgent", "user");
      stepProblem(state.emergency);
      return;
    }
    stepEmergency();
  }

  /* Free-text row: sends the message as a user bubble; bot nudges back to the flow. */
  if (sendBtn && freeInput) {
    const sendFree = () => {
      const v = freeInput.value.trim();
      if (!v) return;
      bubble(v, "user");
      freeInput.value = "";
      botSay("Thanks — please use the buttons above to continue your booking, or call " + BUSINESS_PHONE + " if it's urgent.");
    };
    sendBtn.addEventListener("click", sendFree);
    freeInput.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); sendFree(); } });
  }

  start();
}
