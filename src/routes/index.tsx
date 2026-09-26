import { createFileRoute } from "@tanstack/react-router";
import { BedtimeApp } from "@/components/bedtime/app";

export const Route = createFileRoute("/")({
  component: BedtimeApp,
});
