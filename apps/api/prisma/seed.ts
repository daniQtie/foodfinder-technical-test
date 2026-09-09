import { PrismaClient } from "@prisma/client";

import { config } from "../src/config.ts";

void config.databaseUrl;
const prisma = new PrismaClient();

await prisma.user.upsert({
  where: { email: "demo@example.com" },
  update: {},
  create: {
    id: "demo-user",
    email: "demo@example.com",
  },
});

console.log("Seeded demo user: demo@example.com");
await prisma.$disconnect();
