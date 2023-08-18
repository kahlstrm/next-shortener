import type { ColumnType } from "kysely";

export type Generated<T> = T extends ColumnType<infer S, infer I, infer U>
  ? ColumnType<S, I | undefined, U>
  : ColumnType<T, T | undefined, T>;

export interface ShortenedLinks {
  url: string;
  shorthand: string;
  user_id: string;
  last_modified: Generated<string>;
}

export interface DB {
  shortened_links: ShortenedLinks;
}
