import { createFileRoute } from "@tanstack/react-router";
import React from "react";

export const Route = createFileRoute("/500")({
  component: ServerErrorPage,
});

function ServerErrorPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">500</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Internal Server Error</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. Please try again later.
        </p>
        <div className="mt-6">
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}
