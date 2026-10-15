import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "@fontsource/noto-serif-sc/600.css";
import "@blog/markdown/styles.css";
import "./globals.css";
export const metadata: Metadata = { title: { default:"青山 · 写作后台", template:"%s · 青山写作" }, robots:{ index:false,follow:false } };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="zh-CN"><body>{children}</body></html>; }
