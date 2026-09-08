import { redirect } from "next/navigation";

// v2 rewrite (Umbau-Anweisung v2): the Pre-Market Commitment step is
// gone — Daily Review is the home workflow now.
export default function RootPage() {
  redirect("/daily-review");
}
