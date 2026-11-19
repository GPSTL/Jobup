// Téléchargement d'un export CSV. Contrat : docs/api/exports.md

export type ExportResult = { ok: true; filename: string } | { ok: false; reason: "unauthenticated" | "invalid" | "server" | "network" };

// Enregistre le fichier comme un téléchargement du navigateur
function saveFile(blob: Blob, filename: string) {
	const link = document.createElement("a");
	link.href = URL.createObjectURL(blob);
	link.download = filename;
	link.click();
	URL.revokeObjectURL(link.href);
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
