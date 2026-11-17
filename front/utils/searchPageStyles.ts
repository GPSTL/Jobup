// Classes shared by the public search pages (OffersPage and CompaniesPage),
// so that their fields, buttons and cards stay identical.

export const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
export const field = "flex min-h-12 min-w-0 items-center gap-2.5 rounded-xl border border-[#d1d5db] bg-surface px-4 py-2.5 transition-all duration-200 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20";
export const input = "min-w-0 flex-1 bg-transparent text-sm sm:text-base text-ink outline-none placeholder:text-[#9ca3af]";
export const select = "min-h-12 w-full cursor-pointer appearance-none rounded-xl border border-[#d1d5db] bg-surface py-2.5 pr-10 pl-4 text-sm sm:text-base text-ink outline-none transition-all duration-200 focus:border-primary focus:ring-2 focus:ring-primary/20";
export const searchButton = `min-h-12 cursor-pointer rounded-xl bg-primary px-6 py-2.5 text-sm sm:text-base font-semibold text-on-primary shadow-xs motion-safe:transition-all motion-safe:duration-200 hover:bg-primary/90 hover:shadow-md motion-safe:active:scale-[0.98] ${focus}`;
export const card = "flex flex-col gap-3 rounded-2xl border border-[#e5e7eb] bg-surface p-5 shadow-xs motion-safe:transition-all motion-safe:duration-300 motion-safe:hover:-translate-y-1 hover:shadow-md";
