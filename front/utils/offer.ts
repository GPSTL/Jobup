import { z } from "zod";

export const newOfferSchema = z.object({
  title: z.string().trim().min(1, "Indiquez un intitulé.").max(128, "128 caractères maximum."),
  description: z.string().trim().min(1, "Décrivez le poste.").max(2048, "2 048 caractères maximum."),
  category: z.string().regex(/^[1-9]\d*$/, "Choisissez un secteur."),
  requirements: z.string().trim().max(256, "256 caractères maximum."),
  image_url: z.string().trim().max(200, "200 caractères maximum.").refine(value => {
    if (!value) return true;
    try { return ["http:", "https:"].includes(new URL(value).protocol); } catch { return false; }
  }, "Utilisez une URL HTTP ou HTTPS valide."),
  contract_type: z.enum(["", "alternance", "stage", "cdd", "cdi"]),
  duration: z.string().trim().max(64, "64 caractères maximum."),
  start_date: z.union([z.literal(""), z.iso.date("Indiquez une date valide.")]),
  company: z.string().trim().max(128, "128 caractères maximum."),
  location: z.string().trim().max(128, "128 caractères maximum."),
});

export type NewOfferForm = z.infer<typeof newOfferSchema>;
