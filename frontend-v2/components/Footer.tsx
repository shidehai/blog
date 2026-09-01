import Link from "next/link";
import type { SiteProfile } from "../lib/types";

interface FooterProps {
  profile: SiteProfile;
}

export function Footer({ profile }: FooterProps) {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <p>
          © {new Date().getFullYear()} {profile.name} · {profile.location}
        </p>
        <p>Powered by Next.js 15 &amp; Go Agent Architecture</p>
        <div className="footer-links">
          <Link href={profile.socials.rss} target="_blank" rel="noopener">
            RSS 订阅
          </Link>
          <span>·</span>
          <Link href={profile.socials.github} target="_blank" rel="noopener">
            GitHub
          </Link>
          <span>·</span>
          <Link href={profile.socials.email}>Email</Link>
        </div>
      </div>
    </footer>
  );
}
