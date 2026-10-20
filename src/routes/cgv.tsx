import { createFileRoute, redirect } from "@tanstack/react-router";

// Ancienne adresse des CGV : les textes juridiques sont désormais regroupés sur /legal.
export const Route = createFileRoute("/cgv")({
  beforeLoad: () => {
    throw redirect({ to: "/legal", search: { doc: "cgv-pro" }, replace: true });
  },
});
