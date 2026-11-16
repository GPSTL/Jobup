import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

import Button from "./Button";
import {
	centeredOffset,
	clampOffset,
	displayedSize,
	LOGO_OUTPUT_SIZE,
	MAX_ZOOM,
	minZoom,
	outputRect,
	zoomAroundCenter,
	type Offset,
	type Size,
} from "../utils/logoCrop";
import { focus } from "../utils/searchPageStyles";

type LogoCropDialogProps = {
	/** Image choisie dans les fichiers ; la fenêtre est ouverte tant qu'elle est donnée */
	file: File | null;
	onCancel: () => void;
	/** Logo carré recadré, à envoyer avec le reste de la page */
	onConfirm: (logo: File) => void;
};

// Côté du cadre de recadrage, en pixels : tient dans la fenêtre sur un téléphone de 320 px
const VIEW = 240;
const LOGO_MAX_SIZE = 2 * 1024 * 1024;

function toBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
	return new Promise((resolve) => canvas.toBlob(resolve, type, 0.9));
}

// Fenêtre de recadrage du logo (JOB-066) : l'image choisie est cadrée dans un carré, en la déplaçant
// (souris, doigt ou flèches du clavier) et en zoomant, puis enregistrée en 512 × 512 pixels
export default function LogoCropDialog({ file, onCancel, onConfirm }: LogoCropDialogProps) {
	const dialogRef = useRef<HTMLDialogElement>(null);
	const [url, setUrl] = useState<string | null>(null);
	const image = useRef<HTMLImageElement | null>(null);
	const [size, setSize] = useState<Size | null>(null);
	const [zoom, setZoom] = useState(1);
	const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
	const [error, setError] = useState("");
	const [working, setWorking] = useState(false);
	// Point de départ d'un glissement : position du pointeur et de l'image
	const drag = useRef<{ pointer: Offset; start: Offset } | null>(null);
	const titleId = useId();
	const hintId = useId();

	// Fenêtre modale native : le focus y reste, Échap la ferme et le focus revient au bouton « Changer le logo »
	useEffect(() => {
		if (!file) return;
		const dialog = dialogRef.current;
		dialog?.showModal();
		return () => dialog?.close();
	}, [file]);

	useEffect(() => {
		if (!file) return;
		setSize(null);
		setError("");
		const objectUrl = URL.createObjectURL(file);
		setUrl(objectUrl);
		const loaded = new Image();
		loaded.onload = () => {
			const natural = { width: loaded.naturalWidth, height: loaded.naturalHeight };
			image.current = loaded;
			setSize(natural);
			setZoom(1);
			setOffset(centeredOffset(natural, VIEW, 1));
		};
		loaded.onerror = () => setError("Cette image ne peut pas être lue. Choisissez un autre fichier JPG ou PNG.");
		loaded.src = objectUrl;
		return () => URL.revokeObjectURL(objectUrl);
	}, [file]);

	if (!file) return null;

	const move = (next: Offset) => size && setOffset(clampOffset(next, size, VIEW, zoom));

	const changeZoom = (next: number) => {
		if (!size) return;
		setOffset(zoomAroundCenter(offset, size, VIEW, zoom, next));
		setZoom(next);
	};

	const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
		e.currentTarget.setPointerCapture(e.pointerId);
		drag.current = { pointer: { x: e.clientX, y: e.clientY }, start: offset };
	};
	const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
		const current = drag.current;
		if (current) move({ x: current.start.x + e.clientX - current.pointer.x, y: current.start.y + e.clientY - current.pointer.y });
	};
	const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
		const step = e.shiftKey ? 32 : 8;
		const moves: Record<string, Offset> = { ArrowLeft: { x: step, y: 0 }, ArrowRight: { x: -step, y: 0 }, ArrowUp: { x: 0, y: step }, ArrowDown: { x: 0, y: -step } };
		const delta = moves[e.key];
		if (!delta) return;
		e.preventDefault();
		move({ x: offset.x + delta.x, y: offset.y + delta.y });
	};

	const confirm = async () => {
		if (!size || !image.current || working) return;
		setWorking(true);
		const canvas = document.createElement("canvas");
		canvas.width = canvas.height = LOGO_OUTPUT_SIZE;
		const context = canvas.getContext("2d");
		if (!context) {
			setWorking(false);
			setError("Le recadrage n’est pas disponible dans ce navigateur.");
			return;
		}
		// Un PNG garde sa transparence ; un JPG n'en a pas, le vide éventuel devient blanc
		const png = file.type === "image/png";
		if (!png) {
			context.fillStyle = "#ffffff";
			context.fillRect(0, 0, LOGO_OUTPUT_SIZE, LOGO_OUTPUT_SIZE);
		}
		const rect = outputRect(offset, size, VIEW, zoom);
		context.drawImage(image.current, rect.x, rect.y, rect.width, rect.height);
		let blob = await toBlob(canvas, png ? "image/png" : "image/jpeg");
		let type = png ? "png" : "jpg";
		// Un PNG très détaillé peut dépasser la limite : il est alors enregistré en JPG
		if (blob && blob.size > LOGO_MAX_SIZE) {
			context.globalCompositeOperation = "destination-over";
			context.fillStyle = "#ffffff";
			context.fillRect(0, 0, LOGO_OUTPUT_SIZE, LOGO_OUTPUT_SIZE);
			blob = await toBlob(canvas, "image/jpeg");
			type = "jpg";
		}
		setWorking(false);
		if (!blob) {
			setError("Le recadrage a échoué. Réessayez avec une autre image.");
			return;
		}
		onConfirm(new File([blob], `logo.${type}`, { type: type === "png" ? "image/png" : "image/jpeg" }));
	};

	const shown = size ? displayedSize(size, VIEW, zoom) : null;

	return (
		<dialog
			ref={dialogRef}
			aria-labelledby={titleId}
			onClose={onCancel}
			className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-3xl bg-surface p-6 text-ink shadow-xl backdrop:bg-[rgba(0,0,0,0.5)]"
		>
			<h2 id={titleId} className="text-xl font-semibold">
				Recadrer le logo
			</h2>
			<p id={hintId} className="mt-1 text-sm text-[#6c7386]">
				Déplacez l’image (souris, doigt ou flèches du clavier) et zoomez pour cadrer votre logo dans le carré.
			</p>

			<div className="mt-5 flex flex-col items-center gap-4">
				<div
					tabIndex={0}
					role="img"
					aria-label="Logo à recadrer"
					aria-describedby={hintId}
					onPointerDown={onPointerDown}
					onPointerMove={onPointerMove}
					onPointerUp={() => (drag.current = null)}
					onPointerCancel={() => (drag.current = null)}
					onKeyDown={onKeyDown}
					style={{ width: VIEW, height: VIEW }}
					className={`relative shrink-0 cursor-move touch-none overflow-hidden rounded-[20px] bg-[#f1f3f6] select-none ${focus}`}
				>
					{url && shown && (
						<img
							src={url}
							alt=""
							draggable={false}
							style={{ left: offset.x, top: offset.y, width: shown.width, height: shown.height }}
							className="pointer-events-none absolute max-w-none"
						/>
					)}
				</div>

				{size && (
					<label className="flex w-full items-center gap-3 text-sm font-medium">
						Zoom
						<input
							type="range"
							min={minZoom(size)}
							max={MAX_ZOOM}
							step={0.01}
							value={zoom}
							onChange={(e) => changeZoom(Number(e.target.value))}
							className="flex-1 cursor-pointer accent-primary"
						/>
					</label>
				)}
				{!size && !error && <p className="text-sm text-[#6c7386]">Chargement de l’image…</p>}
			</div>

			{error && (
				<p role="alert" className="mt-4 text-sm font-medium text-[#DC2626]">
					{error}
				</p>
			)}

			<div className="mt-6 flex justify-end gap-3">
				<Button variant="outline" onClick={() => dialogRef.current?.close()} className="px-5 py-2">
					Annuler
				</Button>
				<Button onClick={confirm} disabled={!size || working} className="px-5 py-2">
					{working ? "Recadrage…" : "Valider"}
				</Button>
			</div>
		</dialog>
	);
}
