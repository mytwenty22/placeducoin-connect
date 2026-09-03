import { Megaphone } from "lucide-react";

type SponsorBannerData = {
  image_url: string;
  target_url: string | null;
};

export function SponsorBanner({
  banner,
  placeholderTitle = "Vos annonces ici — Partenaire local",
  placeholderSubtitle = "Touchez les commerçants et habitants de votre ville",
  className = "mx-auto max-w-6xl px-4 pt-4",
}: {
  banner?: SponsorBannerData | null | undefined;
  placeholderTitle?: string;
  placeholderSubtitle?: string;
  className?: string;
}) {
  const inner = banner ? (
    <img
      src={banner.image_url}
      alt="Bannière partenaire"
      className="block h-[200px] w-full object-cover sm:h-[150px]"
    />
  ) : (
    <div className="flex h-[200px] w-full flex-col items-center justify-center gap-1.5 bg-gradient-navy px-4 text-center text-primary-foreground sm:h-[150px]">
      <span className="flex items-center gap-1.5 font-display text-base font-extrabold sm:text-lg">
        <Megaphone className="h-4 w-4 shrink-0" /> {placeholderTitle}
      </span>
      <span className="text-xs text-primary-foreground/70">{placeholderSubtitle}</span>
    </div>
  );

  return (
    <div className={className}>
      <div className="relative overflow-hidden rounded-2xl shadow-card">
        {banner?.target_url ? (
          <a href={banner.target_url} target="_blank" rel="noreferrer sponsored" className="block">
            {inner}
          </a>
        ) : (
          inner
        )}
        <span className="absolute right-2 top-2 rounded-full bg-black/50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white backdrop-blur-sm">
          Sponsorisé
        </span>
      </div>
    </div>
  );
}
