export default function RecommendationSwitch({ checked, onChange, disabled = false }: { checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean }) {
	return <label className="flex cursor-pointer items-center gap-3 text-sm font-semibold">
		<input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} className="peer sr-only" />
		<span aria-hidden="true" className="flex h-6 w-11 shrink-0 items-center rounded-full bg-gray-300 p-1 peer-checked:bg-primary peer-checked:[&>span]:translate-x-5 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary peer-disabled:opacity-50"><span className="size-4 rounded-full bg-white transition-transform" /></span>
		Afficher uniquement les recommandations
	</label>;
}
