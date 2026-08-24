/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    // Set by the Express backend via the Node adapter's `locals` argument.
    user: { login: string } | null;
  }
}
