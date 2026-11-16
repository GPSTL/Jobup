import { companyEmblem } from "../utils/companies";

type CompanyLogoProps = {
	name: string;
	/** Logo choisi par l'entreprise (JOB-066) ; sans logo, ses initiales */
	logoUrl: string | null;
	/** Taille, arrondi et taille du texte */
	className: string;
	/** Couleurs des initiales */
	emblemClassName?: string;
};

// Logo d'une entreprise, ou ses initiales (JOB-021). Décoratif : le nom est toujours affiché à côté.
export default function CompanyLogo({ name, logoUrl, className, emblemClassName = "bg-primary text-on-primary" }: CompanyLogoProps) {
	if (logoUrl) return <img src={logoUrl} alt="" className={`shrink-0 bg-white object-cover ${className}`} />;
	return (
		<span aria-hidden="true" className={`flex shrink-0 items-center justify-center font-bold ${emblemClassName} ${className}`}>
			{companyEmblem(name)}
		</span>
	);
}
