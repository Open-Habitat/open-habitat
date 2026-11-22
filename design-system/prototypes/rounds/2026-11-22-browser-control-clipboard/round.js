// Server browser viewer: taking control from the canvas, and the clipboard.
// Synthetic presentation state only. The "remote page" is an HTML picture of
// a made-up sign-in service standing in for the noVNC canvas; no network, no
// real credentials, nothing is sent anywhere. Agent activity is scripted.
const stage = document.querySelector("#stage");
const params = new URLSearchParams(location.search);
if (!params.has("v")) {
	const u = new URL(location);
	u.searchParams.set("v", "2");
	history.replaceState(null, "", u);
}
const AGENT_EMAIL = "alex@example.com";
const SERVICE_ID = "FI-4471-2290";
const REF = "11 22334 45566";
const S = {
	lang: params.get("lang") === "en" ? "en" : "fi",
	theme: ["dark", "contrast"].includes(params.get("theme"))
		? params.get("theme")
		: "light",
	strict: false,
	dir: 1,
};
let timers = [];
let gen = 0; // bumps on every scenario, so late async results are dropped
const t = (fi, en) => (S.lang === "fi" ? fi : en);

function scenario(name) {
	for (const id of timers) clearInterval(id);
	timers = [];
	gen++;
	Object.assign(S, {
		scenario: name,
		control: "person",
		busy: false,
		waitTake: false,
		request: null,
		wants: false,
		idleLeft: null,
		page: "signin",
		fields: { email: AGENT_EMAIL, password: "", code: "" },
		focus: "password",
		selected: false,
		remoteClip: null,
		remoteClipShown: false,
		pasteOpen: false,
		pasteText: "",
		pasteHidden: false,
		pasted: false,
		clipOpen: false,
		popover: null,
		toast: null,
		notice: null,
		remoteError: null,
		agentAt: null,
	});
	const ask = () =>
		t(
			"Kirjaudu palveluun. Haen laskut, kun annat selaimen takaisin.",
			"Please sign in. I’ll fetch the invoices when you give the browser back.",
		);
	if (name === "person") S.request = ask();
	if (name === "request") {
		S.control = "agent";
		S.request = ask();
		S.focus = null;
		S.agentAt = "password";
	}
	if (name === "busy") {
		S.control = "agent";
		S.busy = true;
		S.fields.email = "";
		S.focus = "email";
		S.agentAt = "email";
		timers.push(setInterval(agentTypes, 260));
	}
	if (name === "wants") {
		S.page = "done";
		S.focus = null;
		S.wants = true;
	}
	if (name === "idle") {
		S.focus = null;
		S.idleLeft = 30;
		timers.push(setInterval(idleTick, 1000));
	}
}

// --- scripted agent ---------------------------------------------------------
function agentTypes() {
	if (!S.busy) return;
	const next = AGENT_EMAIL.slice(0, S.fields.email.length + 1);
	S.fields.email = next;
	if (next === AGENT_EMAIL) {
		S.busy = false;
		S.agentAt = "password";
		S.focus = null;
		S.request = t(
			"Kirjoita salasana. Jatkan, kun annat selaimen takaisin.",
			"Please enter the password. I’ll continue when you give the browser back.",
		);
		if (S.waitTake) {
			S.waitTake = false;
			take(t("Agentin toiminto päättyi. Sinä ohjaat.", "The agent’s step finished. You are in control."));
			S.focus = "password";
		}
		render();
		return;
	}
	const v = document.querySelector('[data-remote="email"] .r-value');
	if (v) v.textContent = next;
	else render();
}
function idleTick() {
	if (S.idleLeft == null) return;
	S.idleLeft -= 1;
	if (S.idleLeft <= 0) {
		S.idleLeft = null;
		giveBack(t(
			"Selain palautui agentille kolmen minuutin tauon jälkeen.",
			"The browser went back to the agent after three idle minutes.",
		));
		return;
	}
	document
		.querySelectorAll("[data-idle]")
		.forEach((e) => (e.textContent = idleText()));
}
const idleText = () =>
	t(
		`Et ole käyttänyt selainta 3 minuuttiin. Se palautuu agentille 0:${String(S.idleLeft).padStart(2, "0")} kuluttua.`,
		`You haven’t used the browser for 3 minutes. It goes back to the agent in 0:${String(S.idleLeft).padStart(2, "0")}.`,
	);

// --- control ---------------------------------------------------------------
function take(message) {
	S.control = "person";
	S.busy = false;
	S.popover = null;
	S.agentAt = null;
	S.toast = message || t("Sinä ohjaat. Agentti odottaa.", "You are in control. The agent waits.");
}
function giveBack(message) {
	S.control = "agent";
	S.request = null;
	S.wants = false;
	S.idleLeft = null;
	S.focus = null;
	S.selected = false;
	S.pasteOpen = false;
	S.clipOpen = false;
	S.pasteText = "";
	S.remoteClip = null;
	S.remoteClipShown = false;
	S.notice = null;
	S.agentAt = S.page === "signin" ? "email" : "list";
	S.toast =
		message ||
		(S.pasted
			? t(
					"Agentti jatkaa. Etäkoneen leikepöytä tyhjennettiin.",
					"The agent continues. The remote clipboard was cleared.",
				)
			: t("Agentti jatkaa.", "The agent continues."));
	S.pasted = false;
}
function activity() {
	if (S.idleLeft != null) {
		S.idleLeft = null;
		for (const id of timers) clearInterval(id);
		timers = [];
	}
}

// --- remote page simulation -------------------------------------------------
const remoteFields = () =>
	S.page === "signin" ? ["email", "password"] : S.page === "code" ? ["code"] : [];
function insert(text, how) {
	if (!S.focus) {
		S.toast = t(
			"Valitse ensin kenttä sivulta, sitten liitä.",
			"Pick a field on the page first, then paste.",
		);
		return false;
	}
	const clean = S.focus === "code" ? text.replace(/\D/g, "").slice(0, 6) : text.replace(/[\r\n]+/g, " ");
	S.fields[S.focus] += clean;
	S.pasted = S.pasted || how === "paste";
	const n = [...clean].length;
	S.toast =
		how === "type"
			? t(`Kirjoitettiin sivulle näppäilyinä · ${n} merkkiä`, `Typed into the page as keystrokes · ${n} characters`)
			: t(`Liitetty sivulle · ${n} merkkiä`, `Pasted into the page · ${n} characters`);
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
		S.wants = true;
	}
}
function remoteCopy() {
	if (!S.selected) {
		S.toast = t(
			"Sivulla ei ole valittua tekstiä. Valitse ensin teksti sivulta.",
			"Nothing is selected on the page. Select text on the page first.",
		);
		render();
		return;
	}
	const text = S.page === "done" ? REF : SERVICE_ID;
	const g = gen;
	// The remote copy reaches the viewer as an RFB clipboard message a moment
	// later; it is dropped if control or the scenario changed meanwhile.
	setTimeout(() => {
		if (g === gen && S.control === "person") arrived(text);
	}, 120);
}
async function arrived(text) {
	S.remoteClip = text;
	if (S.strict) {
		S.remoteClipShown = false;
		S.toast = t(
			"Selain ei antanut kopioida suoraan koneellesi. Kopioi alta.",
			"Your browser did not allow copying straight to your computer. Copy it below.",
		);
		if (S.dir === 0) S.clipOpen = true;
		render();
		return;
	}
	const g = gen;
	try {
		await navigator.clipboard.writeText(text);
		if (g !== gen) return;
		S.remoteClip = null;
		S.toast = t("Kopioitu etäsivulta koneellesi.", "Copied from the remote page to your computer.");
	} catch {
		if (g !== gen) return;
		S.toast = t(
			"Selain ei antanut kopioida suoraan koneellesi. Kopioi alta.",
			"Your browser did not allow copying straight to your computer. Copy it below.",
		);
		if (S.dir === 0) S.clipOpen = true;
	}
	render();
}
async function copyLocal() {
	const text = S.remoteClip;
	try {
		await navigator.clipboard.writeText(text);
		S.remoteClip = null;
		S.remoteClipShown = false;
		S.toast = t("Kopioitu koneellesi.", "Copied to your computer.");
	} catch {
		S.remoteClipShown = true;
		S.toast = t(
			"Kopiointi estettiin. Valitse teksti ja kopioi se itse.",
			"Copying was blocked. Select the text and copy it yourself.",
		);
	}
	render();
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
	warn: svg('<path d="M12 4 3 20h18L12 4z"/><path d="M12 10v4M12 17h.01"/>'),
	down: svg('<path d="m7 10 5 5 5-5"/>'),
};

// --- pieces shared by all directions ------------------------------------------
const btn = (action, label, cls = "", extra = "") =>
	`<button type="button" data-action="${action}" class="${cls}" ${extra}>${label}</button>`;

function turnText() {
	if (S.control === "person") return t("Sinä ohjaat", "You are in control");
	if (S.busy) return t("Agentti toimii", "Agent at work");
	if (S.request) return t("Agentti odottaa sinua", "Agent is waiting for you");
	return t("Agentti ohjaa", "Agent in control");
}
function turnLine() {
	if (S.waitTake)
		return t(
			"Otat ohjauksen, kun agentin toiminto päättyy…",
			"You take control when the agent’s step ends…",
		);
	if (S.control === "person")
		return t(
			"Agentti odottaa, kunnes annat selaimen takaisin. Klikkaa ja kirjoita sivulla kuten omassa selaimessasi.",
			"The agent waits until you give the browser back. Click and type on the page as in your own browser.",
		);
	if (S.busy)
		return t(
			"Agentti kirjoittaa sähköpostiosoitetta. Klikkaus sivulla kysyy ennen kuin keskeyttää sen.",
			"The agent is typing an email address. A click on the page asks before interrupting it.",
		);
	return t(
		"Klikkaa sivua tai ala kirjoittaa, niin ohjaus siirtyy sinulle.",
		"Click the page or start typing to take control.",
	);
}
// The agent's request and its wish to continue are its own words: untrusted text.
function agentSays() {
	if (S.wants && S.control === "person")
		return t(
			"Näyttää siltä, että kirjauduit. Annatko selaimen takaisin, niin haen laskut?",
			"Looks like you signed in. Give the browser back and I’ll fetch the invoices?",
		);
	return S.request;
}
const doneBtn = (cls = "primary", short = false) =>
	S.control === "person"
		? btn(
				"done",
				`${I.check}<span>${S.wants && !short ? t("Valmis, agentti jatkaa", "Done, agent continues") : t("Valmis", "Done")}</span>`,
				cls,
			)
		: S.waitTake
			? btn("cancel-wait", t("Peru", "Cancel"))
			: btn("take", t("Ota ohjaus", "Take control"));
const idleBox = () =>
	S.idleLeft != null && S.control === "person"
		? `<div class="idle"><span data-idle>${idleText()}</span>${btn("keep", t("Pidä ohjaus", "Keep control"))}</div>`
		: "";
const noticeBox = () =>
	S.notice
		? `<div class="notice" role="status">${I.warn}<span>${S.notice}</span>${btn("dismiss-notice", I.cross, "icon", `aria-label="${t("Sulje ilmoitus", "Dismiss notice")}"`)}</div>`
		: "";
const toastBox = (cls = "") =>
	`<p class="toast ${cls}" role="status" aria-live="polite">${S.toast || ""}</p>`;
const pasteHint = () =>
	S.strict
		? t(
				"Tämä selain ei anna liittää suoraan kuvaan. Liitä tähän ja lähetä.",
				"This browser doesn’t allow pasting straight into the picture. Paste here and send.",
			)
		: t(
				"⌘/Ctrl+V liittää suoraan sivulle. Jos se ei toimi, liitä tähän.",
				"⌘/Ctrl+V pastes straight into the page. If that doesn’t work, paste here.",
			);
function pasteForm(id) {
	return `<div class="paste-form" data-paste-form>
<label for="paste-${id}">${t("Teksti sivulle", "Text for the page")}</label>
<textarea id="paste-${id}" data-paste rows="2" class="${S.pasteHidden ? "masked" : ""}" placeholder="${t("Liitä tai kirjoita tähän", "Paste or type here")}" autocomplete="off" spellcheck="false">${escapeHTML(S.pasteText)}</textarea>
<small>${pasteHint()}</small>
<div class="paste-actions">
${btn("send-paste", `${I.paste}<span>${t("Liitä sivulle", "Paste into page")}</span>`, "primary")}
${btn("send-type", `${I.keys}<span>${t("Kirjoita näppäilyinä", "Type as keystrokes")}</span>`)}
<label class="check"><input type="checkbox" data-action="mask" ${S.pasteHidden ? "checked" : ""}> ${t("Piilota teksti", "Hide text")}</label>
</div>
<small>${t(
		"Näppäilyinä toimii sivuilla, jotka estävät liittämisen. Teksti lähtee vain sivulle, ja kenttä tyhjenee lähetyksen jälkeen.",
		"Keystrokes work on sites that block pasting. The text goes only to the page, and this field clears after sending.",
	)}</small>
</div>`;
}
function remoteClipBox() {
	if (!S.remoteClip) return "";
	return `<div class="remote-clip">
<span>${t("Kopioitu etäsivulta", "Copied on the remote page")}</span>
${S.remoteClipShown ? `<input readonly value="${escapeHTML(S.remoteClip)}" aria-label="${t("Kopioitu teksti", "Copied text")}" data-select-all>` : ""}
${btn("copy-local", `${I.copy}<span>${t("Kopioi koneellesi", "Copy to your computer")}</span>`)}
</div>`;
}
const copySelected = () =>
	btn(
		"copy-remote",
		`${I.copy}<span>${t("Kopioi valinta", "Copy selection")}</span>`,
		"",
		S.control === "person" ? "" : "disabled",
	);
const clipNote = () =>
	`<small class="clip-note">${t(
		"Liitetty teksti menee vain sivulle. Etäkoneen leikepöytä tyhjennetään, kun annat ohjauksen takaisin.",
		"Pasted text goes only to the page. The remote clipboard is cleared when you give control back.",
	)}</small>`;

function escapeHTML(s) {
	return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}

// The picture of the remote page. Its colors are fixed: it is a third-party
// site inside the framebuffer, which does not follow Habitat's theme.
function remotePage() {
	const field = (name, label, value, type) => {
		const shown = type === "password" ? "•".repeat([...value].length) : escapeHTML(value);
		return `<div class="r-label">${label}</div><div class="r-field" data-remote="${name}" ${S.focus === name ? 'data-focus="true"' : ""}><span class="r-value">${shown}</span>${S.focus === name && S.control === "person" ? '<span class="r-caret"></span>' : ""}${S.agentAt === name ? `<span class="agent-pointer">${t("agentti", "agent")}</span>` : ""}</div>`;
	};
	let body;
	if (S.page === "signin")
		body = `<h3>${t("Kirjaudu sisään", "Sign in")}</h3>${field("email", t("Sähköposti", "Email"), S.fields.email)}${field("password", t("Salasana", "Password"), S.fields.password, "password")}${S.remoteError ? `<div class="r-error">${S.remoteError}</div>` : ""}<div class="r-button" data-remote="submit">${t("Kirjaudu", "Sign in")}</div><div class="r-small">${t("Palvelutunnus", "Service ID")} <span class="r-select" data-remote="select" ${S.selected ? 'data-selected="true"' : ""}>${SERVICE_ID}</span></div>`;
	else if (S.page === "code")
		body = `<h3>${t("Vahvista kirjautuminen", "Confirm sign-in")}</h3><div class="r-small">${t("Lähetimme 6-numeroisen koodin numeroon •••• 12.", "We sent a 6-digit code to •••• 12.")}</div>${field("code", t("Koodi", "Code"), S.fields.code)}${S.remoteError ? `<div class="r-error">${S.remoteError}</div>` : ""}<div class="r-button" data-remote="submit">${t("Vahvista", "Confirm")}</div>`;
	else
		body = `<h3>${t("Laskut", "Invoices")}</h3><div class="r-row"><span>${t("Lasku 2026-118", "Invoice 2026-118")}</span><span>214,00 €</span></div><div class="r-row"><span>${t("Lasku 2026-117", "Invoice 2026-117")}</span><span>89,50 €</span></div><div class="r-small">${t("Viitenumero", "Reference")} <span class="r-select" data-remote="select" ${S.selected ? 'data-selected="true"' : ""}>${REF}</span></div>${S.agentAt === "list" ? `<span class="agent-pointer at-list">${t("agentti", "agent")}</span>` : ""}`;
	return `<div class="remote"><div class="r-top"><span class="r-logo"></span><span>${t("Laskupalvelu Esimerkki", "Example Billing")}</span><span class="r-url">https://billing.example</span></div><div class="r-card">${body}</div></div>`;
}

function canvasHint() {
	if (S.control === "person" || S.waitTake) return "";
	return `<div class="canvas-hint" aria-hidden="true">${S.busy ? I.agent : I.user}<span>${
		S.busy
			? t("Agentti toimii · klikkaa ottaaksesi ohjauksen", "Agent at work · click to take control")
			: t("Klikkaa tai kirjoita ottaaksesi ohjauksen", "Click or type to take control")
	}</span></div>`;
}
function popover() {
	if (!S.popover) return "";
	return `<div class="popover" role="alertdialog" aria-labelledby="pop-title" aria-describedby="pop-text" style="left:${S.popover.x}%;top:${S.popover.y}%">
<strong id="pop-title">${I.warn} ${t("Agentti on kesken", "The agent is mid-step")}</strong>
<p id="pop-text">${t(
		"Se kirjoittaa sähköpostiosoitetta. Jos otat ohjauksen nyt, sen seuraavat askeleet perutaan ja kenttään voi jäädä puolikas osoite. Agentti katsoo sivun uudelleen ennen kuin jatkaa.",
		"It is typing an email address. If you take control now, its next steps are cancelled and the field may keep a partial address. The agent looks at the page again before continuing.",
	)}</p>
<div>${btn("take-now", t("Ota ohjaus nyt", "Take control now"), "primary")}${btn("take-after", t("Ota, kun se on valmis", "Take when it’s done"))}${btn("pop-cancel", t("Peru", "Cancel"), "quiet")}</div>
</div>`;
}
function screenView() {
	return `<div class="screen" tabindex="0" role="application" data-control="${S.control}" aria-roledescription="${t("etäselain", "remote browser")}" aria-label="${t("Palvelinselaimen näkymä", "Server browser view")} · ${turnText()}" aria-describedby="screen-help">
${remotePage()}${canvasHint()}${popover()}
<span id="screen-help" hidden>${turnLine()}</span>
</div>`;
}
function head() {
	return `<div class="sheet-head"><h2>${t("Oma selain", "Your browser")}</h2>${btn("noop", t("Sulje selain", "Close browser"), "quiet")}${btn("noop", I.cross, "quiet icon", `aria-label="${t("Sulje", "Close")}"`)}</div>`;
}
const truth = () =>
	`<p class="truth">${t(
		"Agentti saa käyttää kaikkea, mihin tämä selain on kirjautunut, sinun nimissäsi.",
		"The agent may use everything this browser is signed in to, in your name.",
	)}</p>`;

// --- directions --------------------------------------------------------------
// 1 Frame: the canvas border is the state; turn and clipboard ride on tabs.
function frameView() {
	const says = agentSays();
	return `<div class="sheet d-frame">${head()}
<div class="frame-wrap"><div class="frame" data-control="${S.control}">
<div class="tab tab-turn">${S.control === "person" ? I.user : I.agent}<strong>${turnText()}</strong>${doneBtn("primary small", true)}</div>
<div class="tab tab-clip">${btn("clip-toggle", `${I.clip}<span>${t("Leikepöytä", "Clipboard")}</span>${I.down}`, "small", `aria-expanded="${S.clipOpen}" aria-controls="clip-pop"`)}</div>
${S.clipOpen ? `<div class="clip-pop" id="clip-pop">${pasteForm("f")}${remoteClipBox()}<div class="row">${copySelected()}</div>${clipNote()}</div>` : ""}
${says ? `<p class="says"><b>${t("Agentti", "Agent")}:</b> ${escapeHTML(says)}</p>` : ""}
${screenView()}
<div class="frame-foot">${noticeBox()}${idleBox()}${toastBox("over")}</div>
</div></div>${truth()}</div>`;
}
// 2 Bar: today's band stays on top; the clipboard gets its own bar below.
function barView() {
	const says = agentSays();
	return `<div class="sheet d-bar">${head()}
<div class="band" data-control="${S.control}">${S.control === "person" ? I.user : I.agent}<div class="band-text"><strong>${turnText()}</strong><span>${says ? `<b>${t("Agentti", "Agent")}:</b> ${escapeHTML(says)}` : turnLine()}</span></div>${doneBtn()}</div>
${noticeBox()}${idleBox()}
<div class="bar-screen">${screenView()}</div>
${S.pasteOpen ? `<div class="drawer">${pasteForm("b")}</div>` : ""}
<div class="clipbar" role="toolbar" aria-label="${t("Leikepöytä", "Clipboard")}">
${btn("paste-toggle", `${I.paste}<span>${t("Liitä…", "Paste…")}</span>`, "", `aria-expanded="${S.pasteOpen}" ${S.control === "person" ? "" : "disabled"}`)}
${copySelected()}
${remoteClipBox()}
${toastBox()}
</div>${truth()}</div>`;
}
// 3 Panel: turn, the agent's words and the clipboard always beside the page.
function panelView() {
	const says = agentSays();
	return `<div class="sheet d-panel">${head()}
<div class="panel-body"><div class="panel-screen">${screenView()}</div>
<aside class="panel" aria-label="${t("Ohjaus ja leikepöytä", "Control and clipboard")}">
<section class="p-turn" data-control="${S.control}"><h3>${S.control === "person" ? I.user : I.agent} ${turnText()}</h3><p>${turnLine()}</p>${says ? `<blockquote><b>${t("Agentti", "Agent")}:</b> ${escapeHTML(says)}</blockquote>` : ""}${doneBtn()}${idleBox()}</section>
${noticeBox()}
<section class="p-clip"><h3>${I.clip} ${t("Leikepöytä", "Clipboard")}</h3>${S.control === "person" ? pasteForm("p") : `<p class="muted">${t("Liittäminen on käytössä, kun ohjaat.", "Pasting works while you are in control.")}</p>`}${remoteClipBox()}<div class="row">${copySelected()}</div>${clipNote()}</section>
${toastBox()}
</aside></div>${truth()}</div>`;
}

const lines = () => [
	t(
		"Kehys: kuvan reuna kertoo vuoron; vuoro ja leikepöytä ovat reunan kielekkeissä.",
		"Frame: the picture’s border shows whose turn it is; turn and clipboard sit on tabs on the border.",
	),
	t(
		"Palkki: nykyinen vuoronauha yläreunassa, leikepöytä omassa palkissaan kuvan alla. Suositus.",
		"Bar: today’s turn band on top, the clipboard in its own bar under the picture. Recommended.",
	),
	t(
		"Paneeli: vuoro, agentin viesti ja leikepöytä aina näkyvissä kuvan vieressä.",
		"Panel: turn, the agent’s message and the clipboard always visible beside the picture.",
	),
];
function review() {
	const opt = (v, label) => `<option value="${v}" ${S.scenario === v ? "selected" : ""}>${label}</option>`;
	return `<section class="review"><h1>${t("Palvelinselain: ohjaus ja leikepöytä", "Server browser: control and clipboard")}</h1>
<ol>${lines().map((l, i) => `<li ${i === S.dir ? 'aria-current="true"' : ""}>${l}</li>`).join("")}</ol>
<p class="shared">${t(
		"Kaikissa sama: klikkaus tai näppäily sivulla ottaa ohjauksen, kun agentti odottaa; kesken olevan agentin kohdalla kysytään ensin. ⌘/Ctrl+V liittää sivulle, ⌘/Ctrl+C sivulla kopioi koneellesi. Paluu: Valmis-painike, tai 3 minuutin tauko, jos agentti ei odota sinua.",
		"Same in all: a click or keystroke on the page takes control when the agent is waiting; if the agent is mid-step, you are asked first. ⌘/Ctrl+V pastes into the page, ⌘/Ctrl+C on the page copies to your computer. Return: the Done button, or 3 idle minutes when the agent isn’t waiting for you.",
	)}</p>
<div class="review-controls">
<label>${t("Kieli", "Language")} <select id="language"><option value="fi" ${S.lang === "fi" ? "selected" : ""}>Suomi</option><option value="en" ${S.lang === "en" ? "selected" : ""}>English</option></select></label>
<label>${t("Teema", "Theme")} <select id="theme"><option value="light" ${S.theme === "light" ? "selected" : ""}>${t("Päivä", "Light")}</option><option value="dark" ${S.theme === "dark" ? "selected" : ""}>${t("Yö", "Dark")}</option><option value="contrast" ${S.theme === "contrast" ? "selected" : ""}>${t("Kontrasti", "Contrast")}</option></select></label>
<label>${t("Tilanne", "Situation")} <select id="situation">${opt("person", t("Sinä ohjaat: kirjautuminen", "You drive: signing in"))}${opt("request", t("Agentti odottaa sinua", "Agent waiting for you"))}${opt("busy", t("Agentti kesken", "Agent mid-step"))}${opt("wants", t("Agentti haluaa jatkaa", "Agent wants to continue"))}${opt("idle", t("3 minuutin tauko", "3 idle minutes"))}</select></label>
<label class="check"><input type="checkbox" id="strict" ${S.strict ? "checked" : ""}> ${t("Tiukka selain (leikepöytä vain painikkeella)", "Strict browser (clipboard only via a button)")}</label>
</div>
<p class="assumption">${t(
		"Toimiva simulaatio: kuva on keksitty kirjautumissivu, agentti on käsikirjoitettu, mitään ei lähetetä. Älä kirjoita oikeita tunnuksia.",
		"Interactive simulation: the picture is a made-up sign-in page, the agent is scripted, nothing is sent. Don’t type real credentials.",
	)}</p></section>`;
}

function page(d, view) {
	S.dir = d;
	document.documentElement.lang = S.lang;
	document.documentElement.dataset.theme = S.theme;
	document
		.querySelectorAll(".proto-picker-item")
		.forEach((b, i) => (b.textContent = [t("1 Kehys", "1 Frame"), t("2 Palkki", "2 Bar"), t("3 Paneeli", "3 Panel")][i]));
	requestAnimationFrame(() => {
		if (typeof moveHighlight === "function") moveHighlight();
	});
	return `${review()}<div class="app" data-direction="${d}">${view()}</div>`;
}

// Re-render in place, keeping focus on the canvas or the paste field.
function render() {
	const a = document.activeElement;
	const key = a?.matches?.(".screen") ? ".screen" : a?.matches?.("[data-paste]") ? "[data-paste]" : null;
	stage.innerHTML = variants[S.dir]();
	if (key) {
		const el = stage.querySelector(key);
		if (el) {
			el.focus({ preventScroll: true });
			if (key === "[data-paste]") el.setSelectionRange(el.value.length, el.value.length);
		}
	}
}

// --- events ------------------------------------------------------------------
stage.addEventListener("change", (e) => {
	if (e.target.id === "language") S.lang = e.target.value;
	else if (e.target.id === "theme") S.theme = e.target.value;
	else if (e.target.id === "situation") scenario(e.target.value);
	else if (e.target.id === "strict") S.strict = e.target.checked;
	else if (e.target.dataset.action === "mask") S.pasteHidden = e.target.checked;
	else return;
	render();
});
stage.addEventListener("input", (e) => {
	if (e.target.matches("[data-paste]")) {
		S.pasteText = e.target.value;
		activity();
	}
});
stage.addEventListener("focusin", (e) => {
	if (e.target.matches("[data-select-all]")) e.target.select();
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
	const a = e.target.closest("[data-action]");
	if (scr && !e.target.closest(".popover")) {
		scr.focus({ preventScroll: true });
		activity();
		if (S.waitTake) return;
		if (S.control === "agent") {
			if (S.busy) {
				// The click is consumed: it only asks, it never lands on the page.
				const box = scr.getBoundingClientRect();
				S.popover = {
					x: Math.min(62, Math.max(4, ((e.clientX - box.left) / box.width) * 100)),
					y: Math.min(52, Math.max(4, ((e.clientY - box.top) / box.height) * 100)),
				};
				render();
				return;
			}
			// An idle agent: the same click takes control and lands on the page.
			take();
		}
		remoteClick(e.target);
		render();
		return;
	}
	if (!a || a.tagName === "INPUT") return;
	const act = a.dataset.action;
	if (act === "noop") return;
	activity();
	if (act === "take") take();
	else if (act === "done") giveBack();
	else if (act === "keep") S.toast = t("Ohjaus pysyy sinulla.", "You keep control.");
	else if (act === "take-now") {
		take(t("Sinä ohjaat. Agentin toiminto keskeytettiin.", "You are in control. The agent’s step was interrupted."));
		S.notice = t(
			"Agentin kesken ollut toiminto keskeytettiin. Sähköpostikenttään jäi puolikas osoite. Agentti katsoo sivun uudelleen ennen kuin jatkaa.",
			"The agent’s unfinished step was interrupted. The email field kept a partial address. The agent looks at the page again before continuing.",
		);
		S.request = null;
		S.focus = "email";
	} else if (act === "take-after") {
		S.popover = null;
		S.waitTake = true;
	} else if (act === "pop-cancel" || act === "cancel-wait") {
		S.popover = null;
		S.waitTake = false;
	} else if (act === "dismiss-notice") S.notice = null;
	else if (act === "paste-toggle") S.pasteOpen = !S.pasteOpen;
	else if (act === "clip-toggle") S.clipOpen = !S.clipOpen;
	else if (act === "send-paste" || act === "send-type") {
		if (S.control !== "person") take();
		if (!S.pasteText) S.toast = t("Kenttä on tyhjä.", "The field is empty.");
		else if (insert(S.pasteText, act === "send-paste" ? "paste" : "type")) {
			S.pasteText = "";
			S.pasteOpen = false;
			S.clipOpen = false;
		}
	} else if (act === "copy-remote") {
		remoteCopy();
		return;
	} else if (act === "copy-local") {
		copyLocal();
		return;
	}
	render();
	if (act === "paste-toggle" && S.pasteOpen) stage.querySelector("[data-paste]")?.focus();
});

// Keys on the canvas belong to the remote page, never to the picker's shortcuts.
stage.addEventListener("keydown", (e) => {
	if (e.target.closest(".popover") && e.key === "Escape") {
		S.popover = null;
		render();
		e.stopPropagation();
		return;
	}
	if (!e.target.matches(".screen")) return;
	e.stopPropagation();
	activity();
	const mod = e.ctrlKey || e.metaKey;
	if (S.waitTake) return;
	if (S.control === "agent") {
		if (["Shift", "Control", "Meta", "Alt", "Tab"].includes(e.key)) return;
		if (S.busy) {
			e.preventDefault();
			S.popover = { x: 30, y: 22 };
			render();
			stage.querySelector(".popover button")?.focus();
			return;
		}
		take();
		if (!S.focus) S.focus = remoteFields()[remoteFields().length - 1] || null;
		if (mod && e.key.toLowerCase() === "v") {
			render();
			return; // the native paste event follows
		}
	}
	if (mod && e.key.toLowerCase() === "v") return; // let the browser fire "paste"
	if (mod && e.key.toLowerCase() === "c") {
		e.preventDefault();
		remoteCopy();
		return;
	}
	if (mod || e.altKey) return;
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
		if (S.focus) {
			if (S.focus !== "code" || /\d/.test(e.key)) S.fields[S.focus] += e.key;
		}
	} else return;
	render();
});

// A trusted paste on the focused canvas carries the person's clipboard text
// without a permission prompt. A strict browser is simulated as one that does
// not deliver it, which sends the person to the explicit paste field.
stage.addEventListener("paste", (e) => {
	if (!e.target.closest?.(".screen")) return;
	e.preventDefault();
	activity();
	if (S.control !== "person") return;
	const text = S.strict ? "" : e.clipboardData?.getData("text/plain") || "";
	if (!text) {
		S.toast = t(
			"Selain ei antanut leikepöytää kuvalle. Liitä teksti kenttään ja lähetä.",
			"Your browser didn’t hand the clipboard to the picture. Paste the text into the field and send.",
		);
		S.pasteOpen = true;
		S.clipOpen = true;
		render();
		stage.querySelector("[data-paste]")?.focus();
		return;
	}
	insert(text, "paste");
	render();
});

scenario("person");
const variants = [() => page(0, frameView), () => page(1, barView), () => page(2, panelView)];
