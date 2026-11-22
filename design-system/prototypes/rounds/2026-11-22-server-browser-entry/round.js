// Synthetic presentation state only. Conversation ownership is proposed, not
// inferred from the production browser status (which has no conversation ID).
const stage = document.querySelector("#stage");
const params = new URLSearchParams(location.search);
let lang = params.get("lang") === "en" ? "en" : "fi";
let theme = ["dark", "contrast"].includes(params.get("theme"))
	? params.get("theme")
	: "light";
let situation = "request",
	conversation = "costs",
	expanded = false,
	railOpen = false,
	direction = 2;
let control = false,
	selection = "ledger",
	returnFocus = null;
if (!params.has("v")) {
	const u = new URL(location);
	u.searchParams.set("v", "3");
	history.replaceState(null, "", u);
}
const t = (fi, en) => (lang === "fi" ? fi : en);
const icon =
	'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 9h18M7 6.5h1m2 0h1"/></svg>';
const button = (id, text, cls = "") => {
	const labels = {
		"rail-toggle": t("Avaa sivupalkki", "Open sidebar"),
		"rail-close": t("Sulje sivupalkki", "Close sidebar"),
		collapse: t("Piilota ikkunat", "Hide windows"),
	};
	return `<button data-action="${id}" class="${cls}"${labels[id] ? ` aria-label="${labels[id]}"` : ""}>${text}</button>`;
};
const titles = () => ({
	ledger: t("Kirjanpito · vahvistus", "Ledger · confirmation"),
	report: t("Kuluraportti", "Expense report"),
	notes: t("Omat muistiinpanot", "Personal notes"),
});
const waiting = () => situation === "request";
const local = () => conversation === "costs" && situation !== "stopped";
const rowVisible = () => direction !== 0 || waiting();
function windowCard(id, scope) {
	return `<button class="window-card" data-action="window-${id}" data-window="${id}"><span class="mini-page"><span class="mini-title">${titles()[id]}</span><span class="mini-rule"></span><span class="mini-rule short"></span>${id === "ledger" && waiting() ? `<span class="wait">${t("Vahvista kirjautuminen", "Confirm sign-in")}</span>` : ""}</span><strong>${titles()[id]}</strong><small>${scope}</small></button>`;
}
function render(d) {
	direction = d;
	document.documentElement.lang = lang;
	document.documentElement.dataset.theme = theme;
	document
		.querySelectorAll(".proto-picker-item")
		.forEach(
			(b, i) =>
				(b.textContent = [
					t("1 Siru", "1 Chip"),
					t("2 Rivi", "2 Rail"),
					t("3 Molemmat", "3 Both"),
				][i]),
		);
	requestAnimationFrame(() => {
		if (typeof moveHighlight === "function") moveHighlight();
	});
	const lines = [
		t(
			"Siru on pääovi; sivupalkkiin tulee rivi vain, kun ikkuna tarvitsee sinua.",
			"The chip is the main door; a rail row appears only when a window needs you.",
		),
		t(
			"Selain asuu sivupalkissa; keskustelussa näkyy vain agentin selaintyön rivi.",
			"The browser lives in the rail; the conversation shows only a line about browser work.",
		),
		t(
			"Sivupalkista koko oma selain, sirusta tämän keskustelun ikkunat. Suositus.",
			"Your whole browser from the rail, this conversation’s windows from the chip. Recommended.",
		),
	];
	return `<section class="review"><h1>${t("Missä palvelinselain asuu?", "Where does the server browser live?")}</h1><ol>${lines.map((l, i) => `<li ${i === d ? 'aria-current="true"' : ""}>${l}</li>`).join("")}</ol><div class="review-controls"><label>${t("Kieli", "Language")} <select id="language"><option value="fi" ${lang === "fi" ? "selected" : ""}>Suomi</option><option value="en" ${lang === "en" ? "selected" : ""}>English</option></select></label><label>${t("Teema", "Theme")} <select id="theme"><option value="light" ${theme === "light" ? "selected" : ""}>${t("Päivä", "Light")}</option><option value="dark" ${theme === "dark" ? "selected" : ""}>${t("Yö", "Dark")}</option><option value="contrast" ${theme === "contrast" ? "selected" : ""}>${t("Kontrasti", "Contrast")}</option></select></label><label>${t("Tilanne", "Situation")} <select id="situation"><option value="request" ${waiting() ? "selected" : ""}>${t("Ikkuna tarvitsee sinua", "Window needs you")}</option><option value="working" ${situation === "working" ? "selected" : ""}>${t("Agentti selaa", "Agent browsing")}</option><option value="stopped" ${situation === "stopped" ? "selected" : ""}>${t("Selain suljettu", "Browser stopped")}</option></select></label></div><p class="assumption">${t("Vedoksen oletus: host osaa yhdistää ikkunan keskusteluun. Nykyinen selainstatus ei kerro tätä. Kaikki sisältö on keksittyä.", "Prototype assumption: the host can associate a window with a conversation. Current browser status cannot. All content is synthetic.")}</p></section>
 <div class="app" data-direction="${d}" data-rail-open="${railOpen}"><aside class="rail"><header><strong>Open Habitat</strong>${button("rail-close", "×", "mobile-only")}</header>${rowVisible() ? button("global", `${icon}<span>${direction === 0 ? t("Ikkuna odottaa sinua", "Window needs you") : t("Oma selain", "Your browser")}<small>${situation === "stopped" ? t("Suljettu", "Stopped") : direction === 0 ? t("Kirjanpito tarvitsee sinua", "Ledger needs you") : t("Kaikki 3 ikkunaa", "All 3 windows")}</small></span>${waiting() ? '<span class="attention-mark">!</span>' : ""}`, "browser-row") : ""}<div class="rail-section">${t("Työtilat", "Workspaces")}</div><strong class="workspace">atelier</strong>${button("conversation-costs", t("Marraskuun kulut", "November expenses"), conversation === "costs" ? "selected" : "")}${button("conversation-plan", t("Kevään suunnitelma", "Spring plan"), conversation === "plan" ? "selected" : "")}<div class="rail-bottom"><span>Demo</span><small>${t("Oma tili", "Your account")}</small></div></aside>
 <main class="conversation"><header class="conversation-header">${button("rail-toggle", "☰" + (waiting() ? ' <span class="attention-mark">!</span>' : ""), "mobile-only")}<div><small>atelier / Pi</small><h2>${conversation === "costs" ? t("Marraskuun kulut", "November expenses") : t("Kevään suunnitelma", "Spring plan")}</h2></div><span class="status">${local() ? (waiting() ? t("Odottaa sinua", "Waiting for you") : t("Työskentelee", "Working")) : t("Valmis", "Done")}</span></header>
 <div class="feed"><div class="user-message">${conversation === "costs" ? t("Kokoa marraskuun kulut kirjanpidosta. Vertaa niitä kuluraporttiin.", "Summarize November’s ledger expenses. Compare them with the expense report.") : t("Tee alustava suunnitelma keväälle.", "Make a first plan for the spring.")}</div><article><small>Pi</small><p>${conversation === "costs" ? t("Avasin kirjanpidon ja kuluraportin samaan selaimeen. Tarkistan ensin puuttuvat tositteet.", "I opened the ledger and expense report in the same browser. I’ll first check for missing receipts.") : t("Suunnitelma on valmis. Voimme tarkentaa aikataulua seuraavaksi.", "The plan is ready. We can refine the schedule next.")}</p></article>
 ${direction === 1 && local() ? `<div class="work-line">${icon}<span>${waiting() ? t("Selain odottaa kirjautumisen vahvistusta. Avaa Oma selain sivupalkista.", "Browser awaiting sign-in confirmation. Open Your browser in the rail.") : t("Agentti käyttää selainta · 2 ikkunaa", "Agent using browser · 2 windows")}</span></div>` : ""}
 </div><div class="composer-area">${direction !== 1 ? dock() : ""}<div class="composer"><textarea aria-label="${t("Viesti", "Message")}" placeholder="${t("Jatka keskustelua…", "Continue the conversation…")}"></textarea><div><small>Pi · Demo</small><button disabled aria-label="${t("Lähetä (vedos)", "Send (prototype)")}">↑</button></div></div><small class="prototype-note">${t("Toimiva vedos · viestiä ei lähetetä", "Interactive prototype · messages are not sent")}</small></div></main></div><dialog id="browser-dialog" aria-labelledby="browser-title"></dialog>`;
}
function dock() {
	if (direction === 2 && !local()) return "";
	const isLocal = local();
	return `<section class="dock">${expanded && situation !== "stopped" ? `<div class="window-strip"><header><strong>${isLocal ? t("Tässä keskustelussa", "In this conversation") : t("Oma selain", "Your browser")}</strong>${button("collapse", "×")}</header><div class="windows">${(isLocal ? ["ledger", "report"] : ["ledger", "report", "notes"]).map((id) => windowCard(id, isLocal ? t("Marraskuun kulut", "November expenses") : t("Oma selain", "Your browser"))).join("")}</div>${direction === 0 ? button("global", t("Näytä kaikki omat ikkunat (3)", "Show all your windows (3)"), "text-button") : ""}</div>` : ""}${waiting() && isLocal ? `<div class="request"><div><strong>${t("Kirjanpito tarvitsee sinua", "Ledger needs you")}</strong><p>${t("Vahvista kirjautuminen. Jatkan sen jälkeen tositteiden tarkistusta.", "Confirm the sign-in. I’ll then continue checking receipts.")}</p></div>${button("request", t("Avaa pyyntö", "Open request"))}</div>` : ""}${button(situation === "stopped" ? "start" : "chip", `${icon}${situation === "stopped" ? t("Käynnistä oma selain", "Start your browser") : direction === 2 ? t("Tämän keskustelun ikkunat · 2", "This conversation’s windows · 2") : t("Selain · 3 ikkunaa", "Browser · 3 windows")} <span aria-hidden="true">${expanded ? "⌃" : "⌄"}</span>`, "chip")}</section>`;
}
function redraw() {
	stage.innerHTML = render(direction);
}
function openBrowser(scope, trigger) {
	returnFocus = trigger;
	selection = scope === "request" ? "ledger" : null;
	const dialog = document.querySelector("#browser-dialog");
	dialog.dataset.scope = scope;
	drawDialog();
	dialog.showModal();
}
function drawDialog() {
	const dialog = document.querySelector("#browser-dialog"),
		scope = dialog.dataset.scope;
	const ids =
		scope === "global" ? ["ledger", "report", "notes"] : ["ledger", "report"];
	dialog.innerHTML = `<header class="dialog-header"><div><small>${t("Palvelinselain · vedos", "Server browser · prototype")}</small><h2 id="browser-title">${scope === "global" ? t("Kaikki omat ikkunat", "All your windows") : t("Marraskuun kulut · ikkunat", "November expenses · windows")}</h2></div>${button("close", t("Sulje", "Close"))}</header><p class="control-mode" data-control="${control}">${control ? t("Ohjaus on sinulla. Agentti odottaa.", "You have control. The agent is waiting.") : t("Vain katselu. Ohjaus pysyy agentilla.", "View only. The agent keeps control.")}</p>${situation === "stopped" ? `<p>${t("Selain on suljettu.", "The browser is stopped.")}</p>${button("start-dialog", t("Käynnistä selain", "Start browser"))}` : `<div class="windows all-windows">${ids.map((id) => windowCard(id, id === "notes" ? t("Ei keskustelua", "No conversation") : t("Marraskuun kulut", "November expenses"))).join("")}</div>${selection ? `<section class="live-window"><small>${selection === "ledger" ? "ledger.example.test" : selection === "report" ? "reports.example.test" : "notes.example.test"}</small><h3>${titles()[selection]}</h3><p>${selection === "ledger" && waiting() ? t("Vahvista kirjautuminen tunnistussovelluksessasi.", "Confirm sign-in in your authenticator app.") : t("Esimerkki-ikkunan sisältö", "Example window content")}</p>${control && selection === "ledger" && waiting() ? button("confirm", t("Vahvistettu (simuloi)", "Confirmed (simulate)")) : ""}</section>` : `<p>${t("Valitse ikkuna katseltavaksi.", "Choose a window to view.")}</p>`}${waiting() ? `<p class="wait">${t("Kirjanpito: vahvista kirjautuminen, jotta agentti voi jatkaa.", "Ledger: confirm sign-in so the agent can continue.")}</p>` : ""}<footer>${button(control ? "give-back" : "take", control ? t("Palauta ohjaus agentille", "Return control to agent") : t("Ota ohjaus", "Take control"))}</footer>`}`;
}
stage.addEventListener("change", (e) => {
	if (e.target.id === "language") lang = e.target.value;
	if (e.target.id === "theme") theme = e.target.value;
	if (e.target.id === "situation") {
		situation = e.target.value;
		control = false;
		expanded = false;
	}
	redraw();
});
stage.addEventListener("click", (e) => {
	const target = e.target.closest("[data-action]");
	if (!target) return;
	const a = target.dataset.action;
	if (a === "global" || a === "request") {
		openBrowser(a, target);
		return;
	}
	if (a.startsWith("window-")) {
		selection = a.slice(7);
		const dialog = document.querySelector("#browser-dialog");
		if (!dialog.open) {
			openBrowser(local() ? "conversation" : "global", target);
			selection = a.slice(7);
		}
		drawDialog();
		return;
	}
	if (a === "close") {
		document.querySelector("#browser-dialog").close();
		returnFocus?.focus();
		return;
	}
	if (a === "take" || a === "give-back") {
		control = a === "take";
		drawDialog();
		return;
	}
	if (a === "confirm") {
		situation = "working";
		drawDialog();
		return;
	}
	if (a === "start-dialog") {
		situation = "working";
		drawDialog();
		return;
	}
	if (a === "rail-toggle") railOpen = !railOpen;
	if (a === "rail-close") railOpen = false;
	if (a === "chip") expanded = !expanded;
	if (a === "collapse") expanded = false;
	if (a === "start") {
		situation = "working";
		expanded = true;
	}
	if (a.startsWith("conversation-")) {
		conversation = a.slice(13);
		expanded = false;
		railOpen = false;
	}
	redraw();
});
// On closing a simulated confirmation, repaint the request state outside the
// modal too. Focus returns to its equivalent entry point, not a removed node.
stage.addEventListener(
	"close",
	(e) => {
		if (e.target.id !== "browser-dialog") return;
		const action = returnFocus?.dataset.action;
		redraw();
		stage.querySelector(`[data-action="${action}"]`)?.focus();
	},
	true,
);
const variants = [() => render(0), () => render(1), () => render(2)];
