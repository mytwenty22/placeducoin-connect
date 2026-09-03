import { useSyncExternalStore } from "react";
import type { CategoryKey } from "@/lib/placeducoin-data";

export type VedetteNotification = {
  id: string;
  title: string;
  body: string;
  category: CategoryKey;
  shop: string;
  slug: string;
  distanceKm?: number;
  createdAt: string;
  read: boolean;
};

const STORAGE_KEY = "pdc:notifications";
const SEEN_KEY = "pdc:notifiedOfferIds";
const CHANNEL_NAME = "pdc-notifications";

let cache: VedetteNotification[] | null = null;
const listeners = new Set<() => void>();
let channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (typeof window === "undefined" || !("BroadcastChannel" in window)) return null;
  if (!channel) {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = () => {
      cache = null;
      listeners.forEach((listener) => listener());
    };
  }
  return channel;
}

function readStorage(): VedetteNotification[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as VedetteNotification[]) : [];
  } catch {
    return [];
  }
}

function writeStorage(list: VedetteNotification[]) {
  cache = list;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }
  listeners.forEach((listener) => listener());
  getChannel()?.postMessage("update");
}

function generateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function getNotifications(): VedetteNotification[] {
  if (!cache) cache = readStorage();
  return cache;
}

export function subscribeNotifications(callback: () => void): () => void {
  getChannel();
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function addNotification(
  input: Omit<VedetteNotification, "id" | "createdAt" | "read">,
): VedetteNotification {
  const notification: VedetteNotification = {
    ...input,
    id: generateId(),
    createdAt: new Date().toISOString(),
    read: false,
  };
  writeStorage([notification, ...readStorage()].slice(0, 50));

  if (
    typeof window !== "undefined" &&
    "Notification" in window &&
    Notification.permission === "granted"
  ) {
    try {
      new Notification(notification.title, { body: notification.body, tag: notification.id });
    } catch {
      // Le constructeur Notification peut échouer sur certains navigateurs mobiles (Safari iOS
      // en PWA non installée) : le centre de notifications interne reste malgré tout à jour.
    }
  }

  return notification;
}

export function markAllRead() {
  writeStorage(readStorage().map((n) => ({ ...n, read: true })));
}

export function markRead(id: string) {
  writeStorage(readStorage().map((n) => (n.id === id ? { ...n, read: true } : n)));
}

function readSeenIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(SEEN_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

export function hasSeenOffer(offerId: string): boolean {
  return readSeenIds().has(offerId);
}

export function markOfferSeen(offerId: string) {
  const seen = readSeenIds();
  seen.add(offerId);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(SEEN_KEY, JSON.stringify([...seen].slice(-200)));
  }
}

export function useNotifications(): VedetteNotification[] {
  return useSyncExternalStore(subscribeNotifications, getNotifications, () => []);
}
