import dotenv from "dotenv";
import { defineConfig } from "prisma/config";

dotenv.config({ path: new URL("../../.env", import.meta.url) });
process.env.DATABASE_URL ??= "mysql://foodfinder:foodfinder@localhost:3306/foodfinder";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // A syntactically valid fallback lets schema generation and validation run before local setup.
    url: process.env.DATABASE_URL ?? "mysql://foodfinder:foodfinder@localhost:3306/foodfinder",
  },
});
