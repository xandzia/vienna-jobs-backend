import "dotenv/config";
import { defineConfig } from "prisma/config";
import { PrismaPg } from "@prisma/adapter-pg";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    adapter: async () => new PrismaPg({ connectionString: process.env["DATABASE_URL"]! }),
  },
  studio: {
    adapter: async () => new PrismaPg({ connectionString: process.env["DATABASE_URL"]! }),
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});