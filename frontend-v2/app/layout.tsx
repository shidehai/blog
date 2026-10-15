import type { Metadata } from "next";
import localFont from "next/font/local";
import { getAllPosts, getProfile } from "../lib/content";
import { LayoutShell } from "../components/LayoutShell";
import { snapshot } from "../lib/content";
import { readRuntimeEnvironment } from "../lib/env";
import { SITE_NAME } from "../lib/seo";
import "@blog/markdown/styles.css";
import "./globals.css";

export const dynamic = "force-dynamic";

const inter = localFont({
  src: "../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2",
  weight: "100 900",
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = localFont({
  src: "../node_modules/@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2",
  weight: "100 800",
  variable: "--font-mono",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const profile = await getProfile();
  return {
    metadataBase: new URL(readRuntimeEnvironment().siteUrl),
    title: {
      default: `青山神司集 · ${profile.name}`,
      template: `%s | 青山神司集`,
    },
    description: profile.bio,
    applicationName: SITE_NAME,
    icons: { icon: "/avatar.svg" },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [profile, posts] = await Promise.all([getProfile(), getAllPosts()]);

  return (
    <html
      lang="zh-CN"
      suppressHydrationWarning
      className={`${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body>
        <LayoutShell
          profile={profile}
          posts={posts}
          generation={(await snapshot()).generation}
        >
          {children}
        </LayoutShell>
      </body>
    </html>
  );
}
