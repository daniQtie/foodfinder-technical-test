import { PrismaClient } from "@prisma/client";

import { config } from "../config.ts";

void config.databaseUrl;

export const prisma = new PrismaClient();
