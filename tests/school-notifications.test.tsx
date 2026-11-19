// Notifications de l'école (JOB-050, ECO-21) : cloche de la barre, liens du panneau, icônes et préférences
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";

import NotificationBell from "../front/components/NotificationBell";
import NotificationList from "../front/components/NotificationList";
import { NotificationSettingsCard } from "../front/components/NotificationSettings";
import SchoolNavbar from "../front/components/SchoolNavbar";
import type { AppNotification } from "../front/services/notifications";
import { kindIcon, ROLE_NOTIFICATIONS } from "../front/utils/notifications";

const render = (element: React.ReactNode) => renderToStaticMarkup(<MemoryRouter>{element}</MemoryRouter>);

const notification = (id: number, kind: AppNotification["kind"], title: string, link: string): AppNotification => ({
	id,
	kind,
	title,
	body: "",
	link,
	created_at: "2026-11-19T09:00:00Z",
	read: false,
});

test("barre de l'école : cloche des notifications avec le nombre de non lues", () => {
	const html = render(<SchoolNavbar />);
	assert.match(html, /<button[^>]*aria-label="Notifications"/);
	assert.match(html, /href="\/school\/notifications"[^>]*>Voir toutes les notifications<\/a>/);
});

test("panneau de l'école : ses pages et ses préférences, jamais celles de l'étudiant", () => {
	const html = render(<NotificationBell role="school" />);
	assert.match(html, /href="\/school\/notifications"/);
	assert.match(html, /href="\/school#notifications"/);
	assert.doesNotMatch(html, /href="\/student/);
});

test("liste : demande, contrat et message, chacun vers sa page de l'école", () => {
	assert.equal(kindIcon("school_request", "school").src, "/static/img/notifications/user-plus.svg");
	const html = render(
		<NotificationList
			notifications={[
				notification(1, "school_request", "Nouvelle demande de rattachement", "/school/students"),
				notification(2, "contract_update", "Nouveau contrat à valider", "/school/contracts"),
				notification(3, "message", "Nouveau message de Lucas Martin", "/school/messages/4"),
			]}
			onOpen={() => {}}
			role="school"
		/>,
	);
	for (const link of ["/school/students", "/school/contracts", "/school/messages/4"]) assert.match(html, new RegExp(`href="${link}"`));
	assert.match(html, /Nouveau contrat à valider/);
});

test("préférences de l'école : demandes et contrats, messages, puis e-mail", () => {
	assert.deepEqual(
		ROLE_NOTIFICATIONS.school.settings.map(({ key }) => key),
		["school_updates", "messages", "email"],
	);
	const html = render(
		<NotificationSettingsCard
			role="school"
			preferences={{ messages: true, application_status: true, new_applications: false, school_updates: false, email: false }}
			loadError=""
			saveError=""
			saving={null}
			onToggle={() => {}}
			onRetry={() => {}}
		/>,
	);
	const switches = [...html.matchAll(/<span id="notification-(\w+)"[^>]*>([^<]+)<\/span><button[^>]*role="switch" aria-checked="(\w+)"/g)];
	assert.deepEqual(
		switches.map(([, key, label, checked]) => [key, label, checked]),
		[
			["school_updates", "Demandes et contrats", "false"],
			["messages", "Nouveaux messages", "true"],
			["email", "Recevoir aussi par e-mail", "false"],
		],
	);
	assert.doesNotMatch(html, /Nouvelles candidatures|Changement de statut/);
});
