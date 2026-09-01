import Link from "next/link";
import type { Category, Series, SiteProfile, Tag } from "../lib/types";

interface SideLeftProps {
  profile: SiteProfile;
  categories: Category[];
  tags: Tag[];
  seriesList: Series[];
}

export function SideLeft({
  profile,
  categories,
  tags,
  seriesList,
}: SideLeftProps) {
  return (
    <aside className="side-left">
      {/* 1. Profile Card */}
      <div className="glass side-card">
        <div className="profile-avatar">
          <img
            src={profile.avatar}
            alt={profile.name}
            width={112}
            height={112}
            loading="lazy"
          />
        </div>
        <div className="profile-name">{profile.name}</div>
        <div className="profile-desc">{profile.title}</div>
        <div className="profile-links">
          <Link
            href={profile.socials.github}
            target="_blank"
            rel="noopener"
            title="GitHub"
          >
            <svg
              className="ui-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3.3-.4 6.8-1.6 6.8-7a5.5 5.5 0 0 0-1.5-3.8A5.1 5.1 0 0 0 19.2.9S18 0.5 15 2.5a13.4 13.4 0 0 0-6 0C6 0.5 4.8.9 4.8.9a5.1 5.1 0 0 0-1.1 2.8A5.5 5.5 0 0 0 2.2 7.5c0 5.4 3.5 6.6 6.8 7A4.8 4.8 0 0 0 8 18v4" />
              <path d="M8 19c-3 .9-3-1.5-4.2-1.8" />
            </svg>
          </Link>
          <Link href="/about" title="关于">
            <svg
              className="ui-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M20 21a8 8 0 0 0-16 0" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </Link>
        </div>
      </div>

      {/* 2. Categories Card */}
      <div className="glass side-card">
        <h4>分类</h4>
        {categories.map((cat) => (
          <div key={cat.slug} className="cat-item">
            <Link href={`/categories/${cat.slug}`}>
              {cat.name}
              <span className="sr-only"> 分类文章</span>
            </Link>
            <span className="cat-count">{cat.count}</span>
          </div>
        ))}
      </div>

      {/* 3. Tags Card */}
      <div className="glass side-card">
        <h4>标签</h4>
        <div className="side-tags">
          {tags.map((tag) => (
            <Link
              key={tag.slug}
              href={`/tags?tag=${encodeURIComponent(tag.name)}`}
              className="side-tag"
            >
              {tag.name}
              <span className="sr-only"> 标签文章</span>
            </Link>
          ))}
        </div>
      </div>

      {/* 4. Series Card */}
      <div className="glass side-card">
        <h4>文章系列</h4>
        <div className="side-series-list">
          {seriesList.map((series) => (
            <Link
              key={series.id}
              className="side-series-item"
              href={`/series/${series.slug}`}
            >
              <span className="side-series-icon">
                <svg
                  className="ui-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="m12 2 9 5-9 5-9-5zM3 12l9 5 9-5M3 17l9 5 9-5" />
                </svg>
              </span>
              <span className="side-series-copy">
                <strong>{series.name}</strong>
                <small>{series.count} 篇</small>
              </span>
              <svg
                className="ui-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
          ))}
        </div>
        <Link className="side-series-all" href="/series">
          查看全部系列{" "}
          <svg
            className="ui-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </aside>
  );
}
