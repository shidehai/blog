\set ON_ERROR_STOP on

CREATE UNIQUE INDEX IF NOT EXISTS posts_topics_pair_unique
  ON posts_topics (posts_id, topics_id);
CREATE UNIQUE INDEX IF NOT EXISTS posts_tags_pair_unique
  ON posts_tags (posts_id, tags_id);
CREATE INDEX IF NOT EXISTS posts_status_published_at_index
  ON posts (status, published_at DESC);
CREATE INDEX IF NOT EXISTS posts_status_kind_published_at_index
  ON posts (status, kind, published_at DESC);
CREATE INDEX IF NOT EXISTS posts_status_category_published_at_index
  ON posts (status, category, published_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS posts_series_order_unique
  ON posts (series, series_order)
  WHERE series IS NOT NULL AND series_order IS NOT NULL;
CREATE INDEX IF NOT EXISTS social_links_settings_sort_index
  ON social_links (site_settings_id, sort);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'posts_status_valid') THEN
    ALTER TABLE posts ADD CONSTRAINT posts_status_valid
      CHECK (status IN ('published', 'archived'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'posts_kind_valid') THEN
    ALTER TABLE posts ADD CONSTRAINT posts_kind_valid
      CHECK (kind IN ('article', 'tutorial', 'note'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'posts_slug_valid') THEN
    ALTER TABLE posts ADD CONSTRAINT posts_slug_valid
      CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'posts_publishable') THEN
    ALTER TABLE posts ADD CONSTRAINT posts_publishable CHECK (
      status <> 'published' OR (
        btrim(title) <> '' AND
        btrim(body) <> '' AND
        published_at IS NOT NULL AND
        (kind = 'note' OR nullif(btrim(summary), '') IS NOT NULL) AND
        (cover_image IS NULL OR cover_decorative OR nullif(btrim(cover_alt), '') IS NOT NULL)
      )
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'topics_slug_valid') THEN
    ALTER TABLE topics ADD CONSTRAINT topics_slug_valid
      CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'categories_slug_valid') THEN
    ALTER TABLE categories ADD CONSTRAINT categories_slug_valid
      CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tags_slug_valid') THEN
    ALTER TABLE tags ADD CONSTRAINT tags_slug_valid
      CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'series_slug_valid') THEN
    ALTER TABLE series ADD CONSTRAINT series_slug_valid
      CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'posts_series_order_paired') THEN
    ALTER TABLE posts ADD CONSTRAINT posts_series_order_paired CHECK (
      (series IS NULL AND series_order IS NULL) OR
      (series IS NOT NULL AND series_order IS NOT NULL AND series_order >= 1)
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'site_settings_locale_valid') THEN
    ALTER TABLE site_settings ADD CONSTRAINT site_settings_locale_valid
      CHECK (locale = 'zh-CN');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'site_settings_timezone_valid') THEN
    ALTER TABLE site_settings ADD CONSTRAINT site_settings_timezone_valid
      CHECK (timezone = 'Asia/Shanghai');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'social_links_icon_valid') THEN
    ALTER TABLE social_links ADD CONSTRAINT social_links_icon_valid
      CHECK (icon IN ('github', 'rss', 'email', 'website', 'mastodon', 'x', 'linkedin'));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION keep_post_slug_stable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.slug IS DISTINCT FROM OLD.slug THEN
    RAISE EXCEPTION 'published post slug is immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS posts_keep_slug_stable ON posts;
CREATE TRIGGER posts_keep_slug_stable
BEFORE UPDATE OF slug ON posts
FOR EACH ROW EXECUTE FUNCTION keep_post_slug_stable();
