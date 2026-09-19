import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/app/precision-parity")({
  beforeLoad: () => {
    throw redirect({ to: "/app/apex" });
  },
  component: () => null,
});
