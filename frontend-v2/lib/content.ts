import { cache } from "react";
import { catalogSchema, publicDetailSchema, postSummarySchema, type PublicCatalog } from "@blog/content-contracts";
import { z } from "zod";
import { cmsPath } from "@blog/content-contracts/paths";
import { readRuntimeEnvironment } from "./env";
import { buildSnapshot } from "./fixture-projector";
import { FIXTURE_ROWS } from "./fixture";
import { generateActivityData, MOCK_PROJECTS } from "./mock";
import type { ActivityDay, Category, Post, PostSummary, Project, Series, SiteProfile, Tag } from "./types";

export class ContentUnavailable extends Error { constructor(){super("内容服务暂时不可用，请稍后重试。");} }
export async function readPublished<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  const environment=readRuntimeEnvironment();
  if(environment.source!=="cms") throw new ContentUnavailable();
  try {
    const response=await fetch(`${environment.url}${cmsPath(`/api/public/${path}`)}`,{cache:"no-store",headers:{Authorization:`Bearer ${environment.token}`},signal:AbortSignal.timeout(5000)});
    if(!response.ok) throw new ContentUnavailable();
    return schema.parse(await response.json());
  } catch { throw new ContentUnavailable(); }
}
function fixture() { return buildSnapshot(FIXTURE_ROWS); }
// React cache deduplicates only within a server render. No module-level promise
// or cross-request content cache may retain an archived publication.
export const snapshot=cache(async():Promise<PublicCatalog>=>{
  if(readRuntimeEnvironment().source==="fixture") {const data=fixture();return catalogSchema.parse({...data,generation:0,posts:data.posts.map(post=>postSummarySchema.parse(post))});}
  return readPublished("catalog",catalogSchema);
});
export const getPostDetail=cache(async(slug:string)=>{
  if(readRuntimeEnvironment().source==="fixture") {const post=fixture().posts.find(post=>post.slug===slug);return post?{generation:0,canonicalSlug:post.slug,post}:null;}
  const environment=readRuntimeEnvironment();
  if(environment.source!=="cms")throw new ContentUnavailable();
  try {
    const response=await fetch(`${environment.url}${cmsPath(`/api/public/posts/${encodeURIComponent(slug)}`)}`,{cache:"no-store",headers:{Authorization:`Bearer ${environment.token}`},signal:AbortSignal.timeout(5000)});
    if(response.status===404)return null;
    if(!response.ok)throw new ContentUnavailable();
    return publicDetailSchema.parse(await response.json());
  }catch{throw new ContentUnavailable();}
});
export async function getProfile():Promise<SiteProfile>{return (await snapshot()).profile;}
export async function getAllPosts():Promise<PostSummary[]>{return (await snapshot()).posts;}
export async function getFeaturedPosts():Promise<PostSummary[]>{const posts=await getAllPosts();const featured=posts.filter(post=>post.featured);return featured.length?featured:posts.slice(0,1);}
export async function getPostBySlug(slug:string):Promise<Post|undefined>{return (await getPostDetail(slug))?.post;}
export async function getCategories():Promise<Category[]>{return (await snapshot()).categories;}
export async function getTags():Promise<Tag[]>{return (await snapshot()).tags;}
export async function getSeriesList():Promise<Series[]>{return (await snapshot()).series;}
export async function getSeriesBySlug(slug:string):Promise<Series|undefined>{return (await snapshot()).series.find(series=>series.slug===slug);}
export async function getNavigationPosts(current:Post):Promise<{prevPost:PostSummary|null;nextPost:PostSummary|null}>{const posts=await getAllPosts();const index=posts.findIndex(post=>post.id===current.id);return {prevPost:index>=0?posts[index+1]??null:null,nextPost:index>0?posts[index-1]??null:null};}
export async function getCategoryBySlug(slug:string):Promise<Category|undefined>{const target=slug.toLowerCase();return (await snapshot()).categories.find(category=>category.slug.toLowerCase()===target||category.name.toLowerCase()===target);}
export async function getPostsByCategory(name:string):Promise<PostSummary[]>{return (await getAllPosts()).filter(post=>post.category.toLowerCase()===name.toLowerCase());}
export async function getActivityInfo():Promise<{days:ActivityDay[];activeDaysCount:number;totalUpdates:number}>{return generateActivityData();}
export async function getAllProjects():Promise<Project[]>{return MOCK_PROJECTS;}
