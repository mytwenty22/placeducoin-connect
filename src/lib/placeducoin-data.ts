import type { Horaire } from "@/lib/horaires";
import type { ThemeVisuel } from "@/lib/site-theme";

export type CategoryKey = "bouche" | "services" | "boutiques" | "locale";

export const CATEGORIES: { key: CategoryKey; label: string; sub: string[] }[] = [
  {
    key: "bouche",
    label: "Bouche & Alimentaire",
    sub: ["Boucher", "Charcutier", "Boulanger", "Primeur"],
  },
  {
    key: "services",
    label: "Services & Bien-être",
    sub: ["Coiffeur", "Institut", "Réparateur"],
  },
  {
    key: "boutiques",
    label: "Boutiques & Mode",
    sub: ["Prêt-à-porter", "Fleuriste", "Déco"],
  },
  { key: "locale", label: "Vie Locale & Mairie", sub: ["Informations de la commune"] },
];

export const CITIES = [
  "Annecy",
  "Bayeux",
  "Colmar",
  "Dinan",
  "Étretat",
  "Figeac",
  "Gordes",
  "Honfleur",
  "Uzès",
  "Sarlat-la-Canéda",
  "Saint-Émilion",
  "Vannes",
];

export type Offer = {
  slug: string;
  shop: string;
  trade: string;
  category: CategoryKey;
  city: string;
  distanceKm: number;
  title: string;
  kind: "promo" | "arrivage" | "evenement";
  priceBefore?: number;
  priceNow?: number;
  endsInHours: number;
  sponsored?: boolean;
  address: string;
  phone: string;
  hours: { day: string; value: string }[];
  services: { name: string; price: string }[];
  premium?: boolean;
  photoUrl?: string;
  logoUrl?: string;
  horaires?: Horaire[];
  themeVisuel?: ThemeVisuel;
  description?: string;
  eventDate?: string;
  createdAt?: string;
  googleRating?: number;
  googleReviewCount?: number;
};

export const OFFERS: Offer[] = [
  {
    googleRating: 4.8,
    googleReviewCount: 82,
    slug: "boucherie-lantoine",
    shop: "Boucherie Lantoine",
    trade: "Boucher-charcutier",
    category: "bouche",
    city: "Annecy",
    distanceKm: 0.4,
    title: "Côte de bœuf maturée 30 jours",
    kind: "promo",
    priceBefore: 32,
    priceNow: 24,
    endsInHours: 4,
    sponsored: true,
    premium: true,
    address: "12 rue du Marché, Annecy",
    phone: "04 50 12 34 56",
    hours: [
      { day: "Lundi", value: "Fermé" },
      { day: "Mar – Ven", value: "7h30 – 13h · 15h – 19h" },
      { day: "Samedi", value: "7h – 19h" },
      { day: "Dimanche", value: "8h – 12h30" },
    ],
    services: [
      { name: "Côte de bœuf maturée (kg)", price: "24 €" },
      { name: "Volaille fermière (kg)", price: "14,90 €" },
      { name: "Plateau apéro charcuterie", price: "18 €" },
      { name: "Rôti de veau préparé (kg)", price: "26,50 €" },
    ],
  },
  {
    googleRating: 4.6,
    googleReviewCount: 65,
    slug: "atelier-camille",
    shop: "L'Atelier de Camille",
    trade: "Coiffeur mixte",
    category: "services",
    city: "Annecy",
    distanceKm: 0.9,
    title: "Brushing offert pour toute couleur",
    kind: "promo",
    priceBefore: 65,
    priceNow: 49,
    endsInHours: 26,
    sponsored: true,
    premium: true,
    address: "3 place Saint-Louis, Annecy",
    phone: "04 50 98 76 54",
    hours: [
      { day: "Mar – Sam", value: "9h – 19h" },
      { day: "Dim – Lun", value: "Fermé" },
    ],
    services: [
      { name: "Coupe femme + brushing", price: "38 €" },
      { name: "Couleur + brushing offert", price: "49 €" },
      { name: "Coupe homme", price: "22 €" },
      { name: "Soin botanique", price: "15 €" },
    ],
  },
  {
    googleRating: 4.9,
    googleReviewCount: 42,
    slug: "fleurs-de-lisa",
    shop: "Les Fleurs de Lisa",
    trade: "Fleuriste",
    category: "boutiques",
    city: "Annecy",
    distanceKm: 1.2,
    title: "Arrivage pivoines de Savoie",
    kind: "arrivage",
    priceNow: 12,
    endsInHours: 9,
    sponsored: true,
    address: "27 avenue des Tilleuls, Annecy",
    phone: "04 50 44 21 09",
    hours: [
      { day: "Lun – Sam", value: "9h – 19h30" },
      { day: "Dimanche", value: "9h – 13h" },
    ],
    services: [
      { name: "Bouquet du marché", price: "dès 12 €" },
      { name: "Composition mariage", price: "sur devis" },
      { name: "Plante d'intérieur", price: "dès 9 €" },
    ],
  },
  {
    googleRating: 4.7,
    googleReviewCount: 85,
    slug: "boulangerie-du-pont",
    shop: "Boulangerie du Pont",
    trade: "Boulanger-pâtissier",
    category: "bouche",
    city: "Annecy",
    distanceKm: 0.3,
    title: "Fournée de 18h : -30% sur les tourtes",
    kind: "promo",
    priceBefore: 6.5,
    priceNow: 4.5,
    endsInHours: 2,
    address: "1 quai du Pont Neuf, Annecy",
    phone: "04 50 11 22 33",
    hours: [{ day: "Tous les jours", value: "6h30 – 19h30" }],
    services: [
      { name: "Baguette tradition", price: "1,30 €" },
      { name: "Tourte de campagne 1kg", price: "4,50 €" },
      { name: "Viennoiserie pur beurre", price: "1,20 €" },
    ],
  },
  {
    googleRating: 4.5,
    googleReviewCount: 67,
    slug: "primeur-des-halles",
    shop: "Primeur des Halles",
    trade: "Primeur",
    category: "bouche",
    city: "Annecy",
    distanceKm: 0.6,
    title: "Arrivage fraises de pleine terre",
    kind: "arrivage",
    priceNow: 3.9,
    endsInHours: 6,
    address: "Halles centrales, stand 4, Annecy",
    phone: "04 50 55 66 77",
    hours: [{ day: "Mar – Dim", value: "7h – 13h30" }],
    services: [
      { name: "Barquette fraises 500g", price: "3,90 €" },
      { name: "Panier de saison", price: "14 €" },
    ],
  },
  {
    googleRating: 4.5,
    googleReviewCount: 51,
    slug: "institut-belle-rive",
    shop: "Institut Belle Rive",
    trade: "Institut de beauté",
    category: "services",
    city: "Annecy",
    distanceKm: 1.8,
    title: "Soin visage 60 min découverte",
    kind: "promo",
    priceBefore: 79,
    priceNow: 55,
    endsInHours: 40,
    address: "8 rue des Lauriers, Annecy",
    phone: "04 50 33 44 55",
    hours: [{ day: "Lun – Sam", value: "10h – 19h" }],
    services: [
      { name: "Soin visage 60 min", price: "55 €" },
      { name: "Massage dos 30 min", price: "39 €" },
    ],
  },
  {
    googleRating: 4.6,
    googleReviewCount: 34,
    slug: "reparation-express",
    shop: "Réparation Express",
    trade: "Réparateur multi-services",
    category: "services",
    city: "Annecy",
    distanceKm: 2.4,
    title: "Diagnostic smartphone offert",
    kind: "promo",
    priceBefore: 25,
    priceNow: 0,
    endsInHours: 72,
    address: "45 route de Genève, Annecy",
    phone: "04 50 77 88 99",
    hours: [{ day: "Lun – Ven", value: "9h – 18h30" }],
    services: [
      { name: "Écran smartphone", price: "dès 69 €" },
      { name: "Batterie", price: "dès 45 €" },
    ],
  },
  {
    googleRating: 4.5,
    googleReviewCount: 78,
    slug: "maison-margot",
    shop: "Maison Margot",
    trade: "Prêt-à-porter",
    category: "boutiques",
    city: "Annecy",
    distanceKm: 0.8,
    title: "Fin de série : -40% sur la collection été",
    kind: "promo",
    priceBefore: 89,
    priceNow: 53,
    endsInHours: 18,
    address: "14 rue Royale, Annecy",
    phone: "04 50 21 43 65",
    hours: [{ day: "Mar – Sam", value: "10h – 19h" }],
    services: [
      { name: "Chemise en lin", price: "53 €" },
      { name: "Robe imprimée", price: "69 €" },
    ],
  },
  {
    googleRating: 4.9,
    googleReviewCount: 29,
    slug: "atelier-deco-nord",
    shop: "Atelier Déco Nord",
    trade: "Décoration & mobilier",
    category: "boutiques",
    city: "Annecy",
    distanceKm: 3.1,
    title: "Arrivage céramiques artisanales",
    kind: "arrivage",
    priceNow: 22,
    endsInHours: 50,
    address: "2 chemin des Artisans, Annecy",
    phone: "04 50 66 12 78",
    hours: [{ day: "Mer – Sam", value: "10h – 18h" }],
    services: [{ name: "Vase grès émaillé", price: "22 €" }],
  },
];

export type CityNotice = {
  id: string;
  city: string;
  title: string;
  body: string;
  date: string;
  type: "Événement" | "Travaux" | "Information";
};

export const CITY_NOTICES: CityNotice[] = [
  {
    id: "n1",
    city: "Annecy",
    title: "Marché de Noël ce samedi",
    body: "Place de l'Hôtel de Ville, de 10h à 20h. 40 exposants et commerçants du centre-ville.",
    date: "Samedi 5 déc.",
    type: "Événement",
  },
  {
    id: "n2",
    city: "Annecy",
    title: "Travaux Grande Rue",
    body: "Circulation alternée du 2 au 12 du mois. Les commerces restent ouverts et accessibles à pied.",
    date: "Du 2 au 12",
    type: "Travaux",
  },
  {
    id: "n3",
    city: "Annecy",
    title: "Braderie des commerçants",
    body: "Inscriptions ouvertes en mairie jusqu'au 20. Emplacement gratuit pour les commerces du centre.",
    date: "Jusqu'au 20",
    type: "Information",
  },
];

export function getOffer(slug: string) {
  return OFFERS.find((o) => o.slug === slug);
}
