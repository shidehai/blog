-- Run psql -X -qAt; keep stdout in a mode-0600 file. Reads content only.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT jsonb_build_object('format','directus-content-source','version',1,'exportedAt',now(),'tables',jsonb_build_object(
'posts', (SELECT coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) FROM (SELECT * FROM public.posts) r),
'topics', (SELECT coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) FROM (SELECT * FROM public.topics) r),
'categories', (SELECT coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) FROM (SELECT * FROM public.categories) r),
'tags', (SELECT coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) FROM (SELECT * FROM public.tags) r),
'series', (SELECT coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) FROM (SELECT * FROM public.series) r),
'posts_tags', (SELECT coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) FROM (SELECT * FROM public.posts_tags) r),
'posts_topics', (SELECT coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) FROM (SELECT * FROM public.posts_topics) r),
'site_settings', (SELECT coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) FROM (SELECT * FROM public.site_settings) r),
'social_links', (SELECT coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) FROM (SELECT * FROM public.social_links) r),
'directus_files', (SELECT coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) FROM (SELECT id,storage,filename_disk,filename_download,folder,type,filesize,width,height,description,created_on,modified_on FROM public.directus_files) r),
'directus_versions', (SELECT coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) FROM (SELECT * FROM public.directus_versions WHERE collection IN ('posts','topics','categories','tags','series','posts_tags','posts_topics','site_settings','social_links')) r),
'directus_revisions', (SELECT coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) FROM (SELECT * FROM public.directus_revisions WHERE collection IN ('posts','topics','categories','tags','series','posts_tags','posts_topics','site_settings','social_links')) r),
'directus_activity', (SELECT coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) FROM (SELECT id,action,collection,item,timestamp FROM public.directus_activity WHERE collection IN ('posts','topics','categories','tags','series','posts_tags','posts_topics','site_settings','social_links')) r)
));
ROLLBACK;
