import { SignUp } from "@clerk/nextjs";
import { dark } from "@clerk/themes";

export const runtime = "edge";
export const preferredRegion = ["fra1", "iad1"];

export default function Page() {
  return (
    <main className="min-h-screen flex justify-center items-center p-24">
      <SignUp appearance={{ baseTheme: dark }} />
    </main>
  );
}
