import { Kysely } from "kysely";
import { DB } from "kysely-codegen";
import { LibsqlDialect } from "@libsql/kysely-libsql";

export const getDB = () =>
  new Kysely<DB>({
    dialect: new LibsqlDialect({
      url: process.env.DATABASE_URL,
    }),
  });
