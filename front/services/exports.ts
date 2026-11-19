// Téléchargement d'un export CSV. Contrat : docs/api/exports.md

export type ExportResult = { ok: true; filename: string } | { ok: false; reason: "unauthenticated" | "invalid" | "server" | "network" };

// Délai avant de libérer l'adresse du fichier : la libérer dès le clic annule le téléchargement
// dans certains navigateurs (Firefox, Safari), qui le lancent après coup
export const REVOKE_DELAY = 1000;

// Enregistre le fichier comme un téléchargement du navigateur
export function saveFile(blob: Blob, filename: string) {
	const href = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = href;
	link.download = filename;
	// Dans la page le temps du clic : certains navigateurs ignorent le clic sur un lien détaché
	document.body.append(link);
	link.click();
	link.remove();
	setTimeout(() => URL.revokeObjectURL(href), REVOKE_DELAY);
}

/** `url` : route d'export avec sa query string (exportQuery() dans utils/exports.ts) */
export async function downloadCsv(url: string, save = saveFile): Promise<ExportResult> {
	let response: Response;
	try { response = await fetch(url, { credentials: "same-origin" }); }
	catch { return { ok: false, reason: "network" }; }
	if (response.status === 401 || response.status === 403) return { ok: false, reason: "unauthenticated" };
	if (response.status === 400) return { ok: false, reason: "invalid" };
	if (!response.ok) return { ok: false, reason: "server" };
	const filename = /filename="([^"]+)"/.exec(response.headers.get("Content-Disposition") ?? "")?.[1] ?? "export.csv";
	try { save(await response.blob(), filename); }
	catch { return { ok: false, reason: "server" }; }
	return { ok: true, filename };
}
