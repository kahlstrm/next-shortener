import { Kysely } from "kysely";
import { LibsqlDialect } from "@libsql/kysely-libsql";
import { DB } from "../types/db";

export const getDB = () => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  return new Kysely<DB>({ dialect: new LibsqlDialect({ url }) });
};
