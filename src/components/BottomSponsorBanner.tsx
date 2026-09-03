import { SponsorBanner } from "@/components/SponsorBanner";

type BottomSponsorBannerData = {
  image_url: string;
  target_url: string | null;
};

export function BottomSponsorBanner({
  banner,
}: {
  banner?: BottomSponsorBannerData | null | undefined;
}) {
  return (
    <SponsorBanner
      banner={banner}
      placeholderTitle="Espace Partenaire Local"
      placeholderSubtitle="Contactez-nous pour réserver cet emplacement"
      className="mx-auto max-w-6xl px-4 pb-4 pt-8"
    />
  );
}
