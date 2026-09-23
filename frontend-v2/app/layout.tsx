import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { getAllPosts, getProfile } from "../lib/content";
import { LayoutShell } from "../components/LayoutShell";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const profile = await getProfile();
  return {
    title: {
      default: `青山神司集 · ${profile.name}`,
      template: `%s | 青山神司集`,
    },
    description: profile.bio,
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
        <LayoutShell profile={profile} posts={posts}>
          {children}
        </LayoutShell>
      </body>
    </html>
  );
}
