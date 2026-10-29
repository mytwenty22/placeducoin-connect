-- Lien ouvert au clic sur une notification du centre de notifications (NotificationBell) : l'offre
-- concernée, pré-sélectionnée sur le Site Pro ou la fiche (/site|/commerce/<slug>?offre=<id>),
-- renseigné par send-promo-alerts. Nul pour les notifications antérieures : l'app ouvre alors
-- /commerce/<commerce_slug>.

alter table public.notifications add column if not exists url text;
