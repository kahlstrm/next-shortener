import { Kysely } from "kysely";
import { LibsqlDialect } from "@libsql/kysely-libsql";
import { DB } from "../types/db";

export const getDB = () =>
  new Kysely<DB>({
    dialect: new LibsqlDialect({
      url: process.env.DATABASE_URL,
    }),
  });
