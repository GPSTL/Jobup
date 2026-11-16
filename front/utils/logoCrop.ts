// Calculs de la fenêtre de recadrage du logo (JOB-066). L'image est affichée dans un cadre carré
// de `view` pixels : à zoom 1, son petit côté remplit le cadre. Dézoomer jusqu'à `minZoom` fait
// tenir toute l'image (un logo très large par exemple), le reste du carré étant laissé vide.

export type Size = { width: number; height: number };
/** Position du coin haut-gauche de l'image dans le cadre, en pixels du cadre */
export type Offset = { x: number; y: number };

/** Côté du logo enregistré, en pixels */
export const LOGO_OUTPUT_SIZE = 512;
export const MAX_ZOOM = 3;

// Zoom qui fait tenir toute l'image dans le cadre
export const minZoom = ({ width, height }: Size) => Math.min(width, height) / Math.max(width, height);

// Taille de l'image affichée dans le cadre
export function displayedSize(image: Size, view: number, zoom: number): Size {
	const scale = (view / Math.min(image.width, image.height)) * zoom;
	return { width: image.width * scale, height: image.height * scale };
}

// Plus grande que le cadre, l'image le couvre toujours ; plus petite, elle reste à l'intérieur
const clampAxis = (value: number, shown: number, view: number) => Math.min(Math.max(value, Math.min(0, view - shown)), Math.max(0, view - shown));

export function clampOffset(offset: Offset, image: Size, view: number, zoom: number): Offset {
	const shown = displayedSize(image, view, zoom);
	return { x: clampAxis(offset.x, shown.width, view), y: clampAxis(offset.y, shown.height, view) };
}

// Image centrée dans le cadre
export function centeredOffset(image: Size, view: number, zoom: number): Offset {
	const shown = displayedSize(image, view, zoom);
	return { x: (view - shown.width) / 2, y: (view - shown.height) / 2 };
}

// Nouveau zoom autour du centre du cadre : le point visé reste au milieu
export function zoomAroundCenter(offset: Offset, image: Size, view: number, from: number, to: number): Offset {
	const ratio = to / from;
	const center = view / 2;
	const moved = { x: center - (center - offset.x) * ratio, y: center - (center - offset.y) * ratio };
	return clampOffset(moved, image, view, to);
}

// Où dessiner l'image dans le logo enregistré (carré de `output` pixels)
export function outputRect(offset: Offset, image: Size, view: number, zoom: number, output = LOGO_OUTPUT_SIZE) {
	const k = output / view;
	const shown = displayedSize(image, view, zoom);
	return { x: offset.x * k, y: offset.y * k, width: shown.width * k, height: shown.height * k };
}
