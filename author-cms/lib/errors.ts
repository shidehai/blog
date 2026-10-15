export class CmsError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "CmsError";
  }
}
export function conflict(): never {
  throw new CmsError(
    409,
    "这篇内容已在其他页面更新。请重新载入，或先复制当前改动。",
  );
}
