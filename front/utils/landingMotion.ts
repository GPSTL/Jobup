import { useEffect, type PointerEvent, type RefObject } from "react";

const clamp = (value: number) => Math.min(1, Math.max(0, value));

/**
 * Scroll animations of the landing page, enabled only when JavaScript runs and the
 * visitor accepts motion; otherwise every element stays visible and static.
 * - `data-reveal`: fades and rises into view once.
 * - `data-progress="hero" | "scroll"`: receives a `--p` variable between 0 and 1.
 * - `data-count`: counts up to its value when revealed.
 */
export function useLandingMotion(rootRef: RefObject<HTMLElement | null>) {
	useEffect(() => {
		const root = rootRef.current;
		if (!root || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
		root.classList.add("landing-motion");

		const animations: number[] = [];
		const countUp = (element: HTMLElement) => {
			const target = Number(element.dataset.count);
			if (!Number.isFinite(target)) return;
			const start = performance.now();
			const step = (now: number) => {
				const t = clamp((now - start) / 1400);
				element.textContent = String(Math.round(target * (1 - (1 - t) ** 3)));
				if (t < 1) animations.push(requestAnimationFrame(step));
			};
			element.textContent = "0";
			animations.push(requestAnimationFrame(step));
		};

		const revealed = root.querySelectorAll<HTMLElement>("[data-reveal]");
		const observer = "IntersectionObserver" in window
			? new IntersectionObserver((entries) => {
				for (const entry of entries) {
					if (!entry.isIntersecting) continue;
					const element = entry.target as HTMLElement;
					element.classList.add("is-in");
					element.querySelectorAll<HTMLElement>("[data-count]").forEach(countUp);
					observer?.unobserve(element);
				}
			}, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" })
			: null;
		revealed.forEach((element) => (observer ? observer.observe(element) : element.classList.add("is-in")));

		const tracked = Array.from(root.querySelectorAll<HTMLElement>("[data-progress]"));
		let frame = 0;
		const update = () => {
			frame = 0;
			const viewport = window.innerHeight;
			for (const element of tracked) {
				const box = element.getBoundingClientRect();
				const progress = element.dataset.progress === "hero"
					? window.scrollY / (viewport * 0.55)
					: (viewport * 0.85 - box.top) / (box.height + viewport * 0.2);
				element.style.setProperty("--p", clamp(progress).toFixed(4));
			}
		};
		const requestUpdate = () => { if (!frame) frame = requestAnimationFrame(update); };
		update();
		window.addEventListener("scroll", requestUpdate, { passive: true });
		window.addEventListener("resize", requestUpdate);

		return () => {
			observer?.disconnect();
			cancelAnimationFrame(frame);
			animations.forEach(cancelAnimationFrame);
			window.removeEventListener("scroll", requestUpdate);
			window.removeEventListener("resize", requestUpdate);
			root.classList.remove("landing-motion");
			revealed.forEach((element) => element.classList.remove("is-in"));
			tracked.forEach((element) => element.style.removeProperty("--p"));
		};
	}, [rootRef]);
}

const isMouse = (event: PointerEvent<HTMLElement>) => event.pointerType === "mouse";

/** Follows the cursor with a glow (`--mx`, `--my`). */
export function trackPointer(event: PointerEvent<HTMLElement>) {
	if (!isMouse(event)) return;
	const element = event.currentTarget;
	const box = element.getBoundingClientRect();
	element.style.setProperty("--mx", `${event.clientX - box.left}px`);
	element.style.setProperty("--my", `${event.clientY - box.top}px`);
}

/** Tilts a card in 3D towards the cursor. */
export function tiltCard(event: PointerEvent<HTMLElement>) {
	if (!isMouse(event)) return;
	trackPointer(event);
	const element = event.currentTarget;
	const box = element.getBoundingClientRect();
	const x = (event.clientX - box.left) / box.width - 0.5;
	const y = (event.clientY - box.top) / box.height - 0.5;
	element.style.setProperty("--rx", `${(-y * 8).toFixed(2)}deg`);
	element.style.setProperty("--ry", `${(x * 10).toFixed(2)}deg`);
}

/** Pulls an element slightly towards the cursor. */
export function attractToPointer(event: PointerEvent<HTMLElement>) {
	if (!isMouse(event)) return;
	const element = event.currentTarget;
	const box = element.getBoundingClientRect();
	element.style.setProperty("--tx", `${((event.clientX - box.left - box.width / 2) * 0.3).toFixed(1)}px`);
	element.style.setProperty("--ty", `${((event.clientY - box.top - box.height / 2) * 0.4).toFixed(1)}px`);
}

/** Restores an element moved by the pointer helpers. */
export function resetPointer(event: PointerEvent<HTMLElement>) {
	for (const name of ["--rx", "--ry", "--tx", "--ty"]) event.currentTarget.style.removeProperty(name);
}
