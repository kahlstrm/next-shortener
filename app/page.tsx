import { UserButton } from "@clerk/nextjs";
import { UrlForm } from "../components/UrlForm";
import { UrlList } from "../components/UrlList";
import { dark } from "@clerk/themes";

export const runtime = "edge";
export const preferredRegion = ["fra1", "iad1"];

export default function Home() {
  return (
    <>
      <main className="flex flex-col items-center min-h-screen">
        <div className="absolute right-4 top-4">
          <UserButton appearance={{ baseTheme: dark }} />
        </div>
        <h2 className="scroll-m-20 font-extrabold tracking-tight lg:text-1xl p-4">
          Totally not the worst URL-shortener that ever existed
        </h2>
        <UrlForm />
        <UrlList />
      </main>
    </>
  );
}
