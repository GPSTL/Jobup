type OfferImageProps = {
	imageUrl?: string | null;
	alt?: string;
	className?: string;
};

export const DEFAULT_OFFER_IMAGE = "/static/img/recruiter/offer-team.png";

export default function OfferImage({ imageUrl, alt = "", className = "" }: OfferImageProps) {
	return <img
		src={imageUrl || DEFAULT_OFFER_IMAGE}
		alt={alt}
		loading="lazy"
		className={className}
		onError={event => {
			if (!event.currentTarget.src.endsWith(DEFAULT_OFFER_IMAGE)) event.currentTarget.src = DEFAULT_OFFER_IMAGE;
		}}
	/>;
}
