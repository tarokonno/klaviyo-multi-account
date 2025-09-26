import { redirect } from "next/navigation";

export default function Home() {
  // Redirect root to Setup
  redirect("/setup");
}
