-- Remplace les 4 thèmes abstraits par 5 presets de marque avec couleurs réelles.
-- On remappe les valeurs existantes vers l'équivalent le plus proche avant de
-- changer la contrainte, pour ne laisser aucune ligne dans un état invalide.
alter table public.commerces drop constraint if exists commerces_theme_visuel_check;

update public.commerces set theme_visuel = case theme_visuel
  when 'sombre' then 'dark_spotify'
  when 'chaleureux' then 'artisanal'
  when 'epure' then 'saas_bleu'
  when 'dynamique' then 'luxe_or'
  else 'saas_bleu'
end;

alter table public.commerces alter column theme_visuel set default 'saas_bleu';
alter table public.commerces add constraint commerces_theme_visuel_check
  check (theme_visuel in ('luxe_or', 'dark_spotify', 'artisanal', 'saas_bleu', 'neo_brasserie'));
