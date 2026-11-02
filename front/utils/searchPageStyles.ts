// Classes shared by the public search pages (OffersPage and CompaniesPage),
// so that their fields, buttons and cards stay identical.

export const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
export const field = "flex min-w-0 items-center gap-2.5 rounded-[14px] border border-[#d1d5db] bg-white py-3.5 pr-3.5 pl-[18px] focus-within:border-primary";
export const input = "min-w-0 flex-1 bg-transparent text-[17px] text-[#111827] outline-none placeholder:text-[#9ca3af]";
export const select = "w-full cursor-pointer appearance-none rounded-[14px] border border-[#d1d5db] bg-white py-3.5 pr-11 pl-[18px] text-[17px] outline-none focus:border-primary";
export const searchButton = `cursor-pointer rounded-[14px] bg-primary px-[22px] py-3.5 text-[16px] font-semibold text-on-primary hover:bg-primary/90 ${focus}`;
export const card = "flex flex-col gap-2.5 rounded-[20px] bg-white px-4 pt-4 pb-[18px] shadow-[0_4px_12px_rgba(0,0,0,0.1)]";
