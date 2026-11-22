// Server browser viewer: what ⌘V / Ctrl+V on the picture does, where focus
// goes after "Type as keystrokes", and the eye toggle on the hidden field.
// Synthetic presentation state only. The "remote page" is an HTML picture of a
// made-up sign-in service standing in for the noVNC canvas. The person's
// clipboard is simulated (an editable sample in the review header): the
// prototype never reads the real clipboard, so a real copied password can
// never appear here. Nothing is sent anywhere.
const stage = document.querySelector("#stage");
const params = new URLSearchParams(location.search);
if (!params.has("v")) {
	const u = new URL(location);
	u.searchParams.set("v", "1");
	history.replaceState(null, "", u);
}
const AGENT_EMAIL = "alex@example.com";
const SERVICE_ID = "FI-4471-2290";
const S = {
	lang: params.get("lang") === "en" ? "en" : "fi",
	theme: ["dark", "contrast"].includes(params.get("theme")) ? params.get("theme") : "light",
	dir: 0,
	sim: "Esim-Salasana-42",
};
const t = (fi, en) => (S.lang === "fi" ? fi : en);

function scenario(name) {
	Object.assign(S, {
		scenario: name,
		control: name === "request" ? "agent" : "person",
		request: t(
			"Kirjaudu palveluun. Haen laskut, kun annat selaimen takaisin.",
			"Please sign in. I’ll fetch the invoices when you give the browser back.",
		),
		page: "signin",
		fields: { email: AGENT_EMAIL, password: "", code: "" },
		focus: name === "request" ? null : "password",
		remoteError: null,
		selected: false,
		clipOpen: false,
		clipReason: null, // "paste" (opened by ⌘V), "hint" (from the toast), null (bar button)
		clipText: "",
		clipMasked: true,
		clipError: null,
		remoteClip: 0, // characters left on the remote clipboard by "Paste into page"
		toast: null,
		toastHint: false,
		flash: false,
		combo: "Ctrl+V",
	});
}

// --- remote page simulation -------------------------------------------------
const remoteFields = () => (S.page === "signin" ? ["email", "password"] : S.page === "code" ? ["code"] : []);
const after = () => t(" Seuraavat näppäimet menevät sivulle.", " Your next keys go to the page.");
function insert(text, how) {
	if (!S.focus) {
		S.toast = t("Valitse ensin kenttä sivulta.", "Pick a field on the page first.");
		return false;
	}
	const clean = S.focus === "code" ? text.replace(/\D/g, "").slice(0, 6) : text.replace(/[\r\n]+/g, " ");
	S.fields[S.focus] += clean;
	const n = [...clean].length;
	if (how === "paste") S.remoteClip = n;
	S.toast =
		how === "type"
			? t(`Kirjoitettiin sivulle näppäilyinä · ${n} merkkiä.`, `Typed into the page as keystrokes · ${n} characters.`)
			: t(`Liitetty sivulle · ${n} merkkiä.`, `Pasted into the page · ${n} characters.`);
	return true;
}
function submit() {
	S.remoteError = null;
	if (S.page === "signin") {
		if (!S.fields.email || !S.fields.password) {
			S.remoteError = t("Täytä sähköposti ja salasana.", "Fill in email and password.");
			S.focus = S.fields.email ? "password" : "email";
			return;
		}
		S.page = "code";
		S.focus = "code";
	} else if (S.page === "code") {
		if (S.fields.code.length < 6) {
			S.remoteError = t("Koodissa on 6 numeroa.", "The code has 6 digits.");
			return;
		}
		S.page = "done";
		S.focus = null;
	}
}

// --- control ---------------------------------------------------------------
function take() {
	if (S.control === "person") return;
	S.control = "person";
	if (!S.focus) S.focus = remoteFields().at(-1) || null;
	S.toast = t("Sinä ohjaat. Agentti odottaa.", "You are in control. The agent waits.");
}
function giveBack() {
	S.control = "agent";
	S.request = null;
	S.focus = null;
	S.clipOpen = false;
	S.clipText = "";
	S.toastHint = false;
	S.toast = S.remoteClip
		? t("Agentti jatkaa. Etäkoneen leikepöytä tyhjennettiin.", "The agent continues. The remote clipboard was cleared.")
		: t("Agentti jatkaa.", "The agent continues.");
	S.remoteClip = 0;
}

// The moment this round is about: ⌘V / Ctrl+V on the picture.
function pasteKey(combo) {
	take();
	S.combo = combo;
	S.toastHint = false;
	if (S.dir === 0) {
		// 1 Ask: the clipboard text waits, hidden, for the person's choice.
		openClip("paste", S.sim);
		return "[data-action='send-type']";
	}
	if (S.dir === 1) {
		// 2 Guide: nothing is taken from the clipboard; the field and the guidance open.
		openClip("paste", "");
		return "[data-clip-field]";
	}
	// 3 Hint: the paste goes through as today; the toast offers the other route.
	if (insert(S.sim, "paste")) S.toastHint = true;
	return ".screen";
}
function openClip(reason, text) {
	S.clipOpen = true;
	S.clipReason = reason;
	S.clipText = text;
	S.clipMasked = true;
	S.clipError = null;
}
function closeClip() {
	S.clipOpen = false;
	S.clipText = "";
	S.clipError = null;
}
// Sending closes the popover and hands focus back to the picture, so the next
// Backspace, Enter or Tab lands on the page and not in the text field.
function send(how) {
	take();
	if (!S.clipText) {
		S.clipError = t("Kirjoita tai liitä ensin teksti.", "Type or paste some text first.");
		return "[data-clip-field]";
	}
	const ok = insert(S.clipText, how);
	closeClip();
	if (ok) {
		S.toast += after();
		S.flash = true;
	}
	return ".screen";
}

// --- icons -------------------------------------------------------------------
const svg = (d) =>
	`<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const I = {
	user: svg('<circle cx="12" cy="8" r="3.5"/><path d="M5 20c1-4 4-6 7-6s6 2 7 6"/>'),
	agent: svg('<rect x="5" y="8" width="14" height="11" rx="3"/><path d="M12 4v4M9 13h.01M15 13h.01"/>'),
	clip: svg('<rect x="6" y="5" width="12" height="16" rx="2"/><path d="M9 5V3h6v2"/>'),
	paste: svg('<rect x="6" y="5" width="12" height="16" rx="2"/><path d="M9 5V3h6v2M12 10v6M9.5 13.5 12 16l2.5-2.5"/>'),
	copy: svg('<rect x="8" y="8" width="11" height="12" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h8"/>'),
	keys: svg('<rect x="3" y="7" width="18" height="11" rx="2"/><path d="M7 11h.01M11 11h.01M15 11h.01M8 15h8"/>'),
	check: svg('<path d="m5 12 4 4 10-10"/>'),
	cross: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
	down: svg('<path d="m7 10 5 5 5-5"/>'),
	eye: svg('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
	eyeOff: svg(
		'<path d="M2 12s3.5-7 10-7c2 0 3.7.6 5.1 1.5M22 12s-3.5 7-10 7c-2 0-3.7-.6-5.1-1.5"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/><path d="M3 3l18 18"/>',
	),
};

const btn = (action, label, cls = "", extra = "") =>
	`<button type="button" data-action="${action}" class="${cls}" ${extra}>${label}</button>`;
function escapeHTML(s) {
	return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}
const turnText = () =>
	S.control === "person"
		? t("Sinä ohjaat", "You are in control")
		: S.request
			? t("Agentti odottaa sinua", "Agent is waiting for you")
			: t("Agentti ohjaa", "Agent in control");

// --- the clipboard popover ----------------------------------------------------
function lead() {
	if (S.clipReason === "paste" && S.dir === 0)
		return t(
			`Painoit ${S.combo}. Leikepöytäsi teksti on alla piilotettuna, eikä sitä ole vielä lähetetty sivulle. Valitse, miten se lähtee.`,
			`You pressed ${S.combo}. Your clipboard text is below, hidden, and nothing has gone to the page yet. Choose how it goes.`,
		);
	if (S.clipReason === "paste")
		return t(
			`${S.combo} ei liitä suoraan sivulle. Liitä tai kirjoita teksti tähän ja valitse, miten se lähtee. Salasanaa ei kannata kopioida: kirjoita se suoraan tähän.`,
			`${S.combo} doesn’t paste straight into the page. Paste or type the text here and choose how it goes. Don’t copy a password: type it straight in here.`,
		);
	if (S.clipReason === "hint")
		return t(
			"Kirjoita salasana tähän. Kirjoita näppäilyinä vie sen sivulle ilman leikepöytää.",
			"Type the password here. Type as keystrokes sends it to the page without the clipboard.",
		);
	return t(
		"Liitä tai kirjoita teksti tähän ja valitse, miten se lähtee sivulle.",
		"Paste or type text here and choose how it goes to the page.",
	);
}
function clipPop() {
	if (!S.clipOpen) return "";
	const shown = !S.clipMasked;
	return `<div class="clip-pop" id="clip-pop" role="dialog" aria-labelledby="clip-title" data-reason="${S.clipReason || "menu"}">
<h3 id="clip-title">${I.clip} ${t("Leikepöytä", "Clipboard")}</h3>
<p class="lead">${lead()}</p>
<label class="field-label" for="clip-field">${t("Teksti sivulle", "Text for the page")}</label>
<div class="field">
<textarea id="clip-field" data-clip-field rows="2" class="${shown ? "" : "masked"}" placeholder="${t("Liitä tai kirjoita tähän", "Paste or type here")}" autocomplete="off" autocapitalize="off" spellcheck="false" ${S.clipError ? 'aria-invalid="true" aria-describedby="clip-error"' : ""}>${escapeHTML(S.clipText)}</textarea>
${btn("eye", shown ? I.eyeOff : I.eye, "eye", `aria-pressed="${shown}" aria-controls="clip-field" aria-label="${shown ? t("Piilota teksti", "Hide text") : t("Näytä teksti", "Show text")}" title="${shown ? t("Piilota teksti", "Hide text") : t("Näytä teksti", "Show text")}"`)}
</div>
${S.clipError ? `<small id="clip-error" role="alert">${S.clipError}</small>` : ""}
<div class="actions">
${btn("send-type", `${I.keys}<span>${t("Kirjoita näppäilyinä", "Type as keystrokes")}</span>`, "primary")}
${btn("send-paste", `${I.paste}<span>${t("Liitä sivulle", "Paste into page")}</span>`)}
</div>
<ul class="guide">
<li><b>${t("Kirjoita näppäilyinä", "Type as keystrokes")}</b> ${t(
		"ei käy leikepöydän kautta. Kun kirjoitat salasanan suoraan tähän, se ei jää myöskään oman koneesi leikepöytään tai sen historiaan.",
		"doesn’t go through a clipboard. Type a password straight in here and it also stays out of your own computer’s clipboard and its history.",
	)}</li>
<li><b>${t("Liitä sivulle", "Paste into page")}</b> ${t(
		"käy etäkoneen leikepöydän kautta. Se tyhjennetään, kun annat ohjauksen takaisin.",
		"goes through the remote clipboard. It is cleared when you give control back.",
	)}</li>
<li class="honest">${t(
		"Kummallakin tavalla teksti päätyy sivulle, eikä sitä piiloteta agentilta.",
		"Either way the text lands on the page and is not hidden from the agent.",
	)}</li>
</ul>
${S.remoteClip ? `<p class="remote-state" data-remote-clip>${t(`Etäkoneen leikepöydällä on ${S.remoteClip} merkkiä, kunnes annat ohjauksen takaisin.`, `The remote clipboard holds ${S.remoteClip} characters until you give control back.`)}</p>` : ""}
<hr>
<div class="actions">${btn("copy-remote", `${I.copy}<span>${t("Kopioi valinta koneellesi", "Copy selection to your computer")}</span>`)}${btn("clip-close", t("Sulje", "Close"), "quiet")}</div>
</div>`;
}

// --- the remote picture -------------------------------------------------------
// Fixed colors on purpose: a third-party site does not follow Habitat's theme.
function remotePage() {
	const field = (name, label, value, type) => {
		const shown = type === "password" ? "•".repeat([...value].length) : escapeHTML(value);
		return `<div class="r-label">${label}</div><div class="r-field" data-remote="${name}" ${S.focus === name ? 'data-focus="true"' : ""}><span class="r-value">${shown}</span>${S.focus === name && S.control === "person" ? '<span class="r-caret"></span>' : ""}</div>`;
	};
	let body;
	if (S.page === "signin")
		body = `<h3>${t("Kirjaudu sisään", "Sign in")}</h3>${field("email", t("Sähköposti", "Email"), S.fields.email)}${field("password", t("Salasana", "Password"), S.fields.password, "password")}${S.remoteError ? `<div class="r-error">${S.remoteError}</div>` : ""}<div class="r-button" data-remote="submit">${t("Kirjaudu", "Sign in")}</div><div class="r-small">${t("Palvelutunnus", "Service ID")} <span class="r-select" data-remote="select" ${S.selected ? 'data-selected="true"' : ""}>${SERVICE_ID}</span></div>`;
	else if (S.page === "code")
		body = `<h3>${t("Vahvista kirjautuminen", "Confirm sign-in")}</h3><div class="r-small">${t("Lähetimme 6-numeroisen koodin numeroon •••• 12.", "We sent a 6-digit code to •••• 12.")}</div>${field("code", t("Koodi", "Code"), S.fields.code)}${S.remoteError ? `<div class="r-error">${S.remoteError}</div>` : ""}<div class="r-button" data-remote="submit">${t("Vahvista", "Confirm")}</div>`;
	else
		body = `<h3>${t("Laskut", "Invoices")}</h3><div class="r-row"><span>${t("Lasku 2026-118", "Invoice 2026-118")}</span><span>214,00 €</span></div><div class="r-row"><span>${t("Lasku 2026-117", "Invoice 2026-117")}</span><span>89,50 €</span></div>`;
	return `<div class="remote"><div class="r-top"><span class="r-logo"></span><span>${t("Laskupalvelu Esimerkki", "Example Billing")}</span><span class="r-url">https://billing.example</span></div><div class="r-card">${body}</div></div>`;
}

function view() {
	const person = S.control === "person";
	const toast = `<div class="toast-row"><p class="toast" role="status" aria-live="polite">${S.toast || ""}</p>${
		S.toastHint && S.toast
			? btn("hint", `${I.keys}<span>${t("Salasanan voit kirjoittaa näppäilyinä", "Type a password as keystrokes instead")}</span>`, "small")
			: ""
	}${S.toast ? btn("toast-close", I.cross, "quiet icon small", `aria-label="${t("Sulje ilmoitus", "Dismiss")}"`) : ""}</div>`;
	return `<div class="sheet">
<div class="bar">
<h2>${t("Oma selain", "Your browser")}</h2>
<span class="turn" data-control="${S.control}">${person ? I.user : I.agent}<span>${turnText()}</span></span>
<span class="bar-gap"></span>
<span class="bar-break" aria-hidden="true"></span>
${btn("clip-toggle", `${I.clip}<span>${t("Leikepöytä", "Clipboard")}</span>${I.down}`, "clip-btn", `aria-expanded="${S.clipOpen}" aria-controls="clip-pop"`)}
${person ? btn("done", `${I.check}<span>${t("Valmis", "Done")}</span>`, "primary turn-btn") : btn("take", t("Ota ohjaus", "Take control"), "turn-btn")}
${btn("noop", t("Sulje selain", "Close browser"), "quiet close-text")}
${btn("noop", I.cross, "quiet icon", `aria-label="${t("Sulje", "Close")}"`)}
${clipPop()}
</div>
${S.request ? `<p class="says"><b>${t("Agentti", "Agent")}:</b> ${escapeHTML(S.request)}</p>` : ""}
<div class="frame-wrap"><div class="frame" data-control="${S.control}">
<div class="screen${S.flash ? " flash" : ""}" tabindex="0" role="application" data-control="${S.control}" aria-roledescription="${t("etäselain", "remote browser")}" aria-label="${t("Palvelinselaimen näkymä", "Server browser view")} · ${turnText()}">
${remotePage()}
<span class="keys-here" aria-hidden="true">${I.keys}${t("Näppäimet menevät sivulle", "Keys go to the page")}</span>
</div>
${toast}
</div></div>
<p class="truth">${t(
		"Agentti saa käyttää kaikkea, mihin tämä selain on kirjautunut, sinun nimissäsi.",
		"The agent may use everything this browser is signed in to, in your name.",
	)}</p>
</div>`;
}

// --- review header --------------------------------------------------------------
const lines = () => [
	t(
		"Kysyy: ⌘V avaa Leikepöydän, jossa teksti odottaa piilotettuna, ja kysyy: Kirjoita näppäilyinä vai Liitä sivulle. Suositus.",
		"Ask: ⌘V opens the Clipboard with the text waiting, hidden, and asks: Type as keystrokes or Paste into page. Recommended.",
	),
	t(
		"Ohjaa: ⌘V avaa Leikepöydän tyhjänä ohjeen kanssa; teksti liitetään tai kirjoitetaan kenttään itse.",
		"Guide: ⌘V opens the Clipboard empty with guidance; you paste or type the text into the field yourself.",
	),
	t(
		"Vinkki: ⌘V liittää kuten nyt, ja ilmoitus tarjoaa salasanalle näppäilyreitin.",
		"Hint: ⌘V pastes as today, and the notice offers the keystroke route for a password.",
	),
];
function review() {
	const opt = (v, label) => `<option value="${v}" ${S.scenario === v ? "selected" : ""}>${label}</option>`;
	return `<section class="review"><h1>${t("Palvelinselain: ⌘V, näppäilyt ja silmä", "Server browser: ⌘V, keystrokes and the eye")}</h1>
<ol>${lines().map((l, i) => `<li ${i === S.dir ? 'aria-current="true"' : ""}>${l}</li>`).join("")}</ol>
<p class="shared">${t(
		"Kaikissa sama: Kirjoita näppäilyinä tai Liitä sivulle sulkee Leikepöydän ja palauttaa näppäimet sivulle, joten seuraava Backspace, Enter tai Tab menee sivulle. Kenttä on piilotettu, ja silmä sen oikeassa reunassa näyttää tekstin. Kokeile: klikkaa salasanakenttää kuvassa, paina ⌘V tai Ctrl+V, lähetä ja paina Backspace.",
		"Same in all: Type as keystrokes or Paste into page closes the Clipboard and hands the keys back to the page, so the next Backspace, Enter or Tab lands on the page. The field is hidden, and the eye at its right edge shows the text. Try it: click the password field in the picture, press ⌘V or Ctrl+V, send, then press Backspace.",
	)}</p>
<div class="review-controls">
<label>${t("Kieli", "Language")} <select id="language"><option value="fi" ${S.lang === "fi" ? "selected" : ""}>Suomi</option><option value="en" ${S.lang === "en" ? "selected" : ""}>English</option></select></label>
<label>${t("Teema", "Theme")} <select id="theme"><option value="light" ${S.theme === "light" ? "selected" : ""}>${t("Päivä", "Light")}</option><option value="dark" ${S.theme === "dark" ? "selected" : ""}>${t("Yö", "Dark")}</option><option value="contrast" ${S.theme === "contrast" ? "selected" : ""}>${t("Kontrasti", "Contrast")}</option></select></label>
<label>${t("Tilanne", "Situation")} <select id="situation">${opt("person", t("Sinä ohjaat: kirjautuminen", "You drive: signing in"))}${opt("request", t("Agentti odottaa sinua", "Agent waiting for you"))}</select></label>
<label class="sim-clip">${t("Leikepöytäsi (keksitty)", "Your clipboard (made up)")} <input id="sim" value="${escapeHTML(S.sim)}" autocomplete="off" spellcheck="false"></label>
</div>
<p class="assumption">${t(
		"Toimiva simulaatio: kuva on keksitty kirjautumissivu, eikä prototyyppi lue oikeaa leikepöytääsi. ⌘V käyttää yllä olevaa keksittyä tekstiä. Mitään ei lähetetä.",
		"Interactive simulation: the picture is a made-up sign-in page, and the prototype never reads your real clipboard. ⌘V uses the made-up text above. Nothing is sent.",
	)}</p></section>`;
}

function page(d) {
	S.dir = d;
	document.documentElement.lang = S.lang;
	document.documentElement.dataset.theme = S.theme;
	document
		.querySelectorAll(".proto-picker-item")
		.forEach((b, i) => (b.textContent = [t("1 Kysyy", "1 Ask"), t("2 Ohjaa", "2 Guide"), t("3 Vinkki", "3 Hint")][i]));
	requestAnimationFrame(() => {
		if (typeof moveHighlight === "function") moveHighlight();
	});
	return `${review()}<div class="app" data-direction="${d}">${view()}</div>`;
}

// Re-render in place. `focusSel` names where focus goes next; otherwise the
// focused canvas, field or button keeps focus.
function render(focusSel) {
	const a = document.activeElement;
	const keep = a?.matches?.(".screen")
		? ".screen"
		: a?.matches?.("[data-clip-field]")
			? "[data-clip-field]"
			: a?.matches?.("#sim")
				? "#sim"
				: a?.dataset?.action
					? `[data-action="${a.dataset.action}"]`
					: null;
	stage.innerHTML = variants[S.dir]();
	S.flash = false;
	const el = stage.querySelector(focusSel || keep || "#none");
	if (el) {
		el.focus({ preventScroll: true });
		if (el.matches("textarea, input")) el.setSelectionRange(el.value.length, el.value.length);
	}
}

// --- events ------------------------------------------------------------------
stage.addEventListener("change", (e) => {
	if (e.target.id === "language") S.lang = e.target.value;
	else if (e.target.id === "theme") S.theme = e.target.value;
	else if (e.target.id === "situation") scenario(e.target.value);
	else return;
	render();
});
stage.addEventListener("input", (e) => {
	if (e.target.matches("[data-clip-field]")) {
		S.clipText = e.target.value;
		if (S.clipError) {
			S.clipError = null;
			render();
		}
	} else if (e.target.id === "sim") S.sim = e.target.value;
});

function remoteClick(target) {
	const r = target.closest("[data-remote]")?.dataset.remote;
	S.selected = false;
	if (!r) return;
	if (r === "select") S.selected = true;
	else if (r === "submit") submit();
	else if (remoteFields().includes(r)) S.focus = r;
}

stage.addEventListener("click", (e) => {
	const scr = e.target.closest(".screen");
	if (scr) {
		// A click on the picture is the person's: it takes control (the agent is
		// waiting in this round) and lands on the page. It also closes the popover.
		take();
		S.clipOpen = false;
		remoteClick(e.target);
		render(".screen");
		return;
	}
	const a = e.target.closest("[data-action]");
	if (!a) return;
	const act = a.dataset.action;
	let next;
	if (act === "noop") return;
	if (act === "take") {
		take();
		next = ".screen";
	} else if (act === "done") giveBack();
	else if (act === "clip-toggle") {
		if (S.clipOpen) {
			closeClip();
			next = ".screen";
		} else {
			openClip(null, "");
			next = "[data-clip-field]";
		}
	} else if (act === "clip-close") {
		closeClip();
		next = ".screen";
	} else if (act === "eye") {
		S.clipMasked = !S.clipMasked;
	} else if (act === "send-type") next = send("type");
	else if (act === "send-paste") next = send("paste");
	else if (act === "hint") {
		S.toastHint = false;
		S.toast = null;
		openClip("hint", "");
		next = "[data-clip-field]";
	} else if (act === "toast-close") {
		S.toast = null;
		S.toastHint = false;
		next = ".screen";
	} else if (act === "copy-remote") {
		copySelection();
		return;
	}
	render(next);
});
async function copySelection() {
	if (!S.selected) {
		S.toast = t("Valitse ensin teksti sivulta.", "Select text on the page first.");
		render();
		return;
	}
	try {
		await navigator.clipboard.writeText(SERVICE_ID);
		S.toast = t("Kopioitu etäsivulta koneellesi.", "Copied from the remote page to your computer.");
	} catch {
		S.toast = t("Selain ei antanut kopioida. Valitse teksti ja kopioi se itse.", "Your browser did not allow copying. Select the text and copy it yourself.");
	}
	render();
}

const isPasteKey = (e) => (e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "v";

stage.addEventListener("keydown", (e) => {
	// Escape in the popover closes it and returns the keys to the page.
	if (e.key === "Escape" && e.target.closest(".clip-pop")) {
		e.preventDefault();
		closeClip();
		render(".screen");
		return;
	}
	// ⌘V in the field pastes the (simulated) clipboard into the local field
	// only. Nothing leaves until a button is pressed.
	if (e.target.matches("[data-clip-field]") && isPasteKey(e)) {
		e.preventDefault();
		S.clipText += S.sim;
		S.clipError = null;
		render("[data-clip-field]");
		return;
	}
	if (!e.target.matches(".screen")) return;
	// Keys on the canvas belong to the remote page, never to the picker.
	e.stopPropagation();
	if (isPasteKey(e)) {
		e.preventDefault();
		render(pasteKey(e.metaKey ? "⌘V" : "Ctrl+V"));
		return;
	}
	if (e.ctrlKey || e.metaKey || e.altKey) return;
	if (["Shift", "Control", "Meta", "Alt", "Escape", "CapsLock"].includes(e.key)) return;
	if (S.control === "agent") {
		if (e.key === "Tab") return;
		take();
	}
	if (e.key === "Tab") {
		const f = remoteFields();
		if (!f.length) return;
		e.preventDefault();
		S.focus = f[(f.indexOf(S.focus) + 1) % f.length];
	} else if (e.key === "Enter") {
		e.preventDefault();
		submit();
	} else if (e.key === "Backspace") {
		e.preventDefault();
		if (S.focus) S.fields[S.focus] = [...S.fields[S.focus]].slice(0, -1).join("");
	} else if (e.key.length === 1) {
		e.preventDefault();
		if (S.focus && (S.focus !== "code" || /\d/.test(e.key))) S.fields[S.focus] += e.key;
	} else return;
	render(".screen");
});
// A native paste on the canvas is swallowed: the keydown above already acted.
stage.addEventListener("paste", (e) => {
	if (e.target.closest?.(".screen") || e.target.matches?.("[data-clip-field]")) e.preventDefault();
});

scenario("person");
const variants = [() => page(0), () => page(1), () => page(2)];
