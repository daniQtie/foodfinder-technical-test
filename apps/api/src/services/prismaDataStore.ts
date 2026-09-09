import type { DataStore, SubscriptionUpdate } from "../types/dependencies.ts";
import type { SupportedLanguage } from "../types/product.ts";
import { HttpError } from "../utils/httpError.ts";
import { prisma } from "../lib/prisma.ts";

const DEMO_EMAIL = "demo@example.com";

const isUniqueConstraintError = (error: unknown): boolean =>
  typeof error === "object" && error !== null && "code" in error && error.code === "P2002";

export class PrismaDataStore implements DataStore {
  async getDemoUser() {
    const user = await prisma.user.findUnique({
      where: { email: DEMO_EMAIL },
      include: { subscription: true },
    });

    if (!user) {
      throw new HttpError(500, "DEMO_USER_NOT_FOUND", "The demo user has not been seeded.");
    }

    return {
      id: user.id,
      email: user.email,
      stripeCustomerId: user.stripeCustomerId,
      subscription: user.subscription
        ? {
            status: user.subscription.status,
            currentPeriodEnd: user.subscription.currentPeriodEnd,
            cancelAtPeriodEnd: user.subscription.cancelAtPeriodEnd,
          }
        : null,
    };
  }

  async saveSearch(userId: string, query: string, language: SupportedLanguage) {
    await prisma.search.create({ data: { userId, query, language } });
  }

  async getRecentSearches(userId: string, limit: number) {
    return prisma.search.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { id: true, query: true, language: true, createdAt: true },
    });
  }

  async updateStripeCustomer(userId: string, stripeCustomerId: string) {
    await prisma.user.update({ where: { id: userId }, data: { stripeCustomerId } });
  }

  async findUserByStripeCustomerId(stripeCustomerId: string) {
    return prisma.user.findUnique({
      where: { stripeCustomerId },
      select: { id: true },
    });
  }

  async upsertSubscription(update: SubscriptionUpdate) {
    await prisma.subscription.upsert({
      where: { userId: update.userId },
      update: {
        stripeSubscriptionId: update.stripeSubscriptionId,
        status: update.status,
        currentPeriodEnd: update.currentPeriodEnd,
        cancelAtPeriodEnd: update.cancelAtPeriodEnd,
      },
      create: update,
    });
  }

  async hasProcessedStripeEvent(eventId: string) {
    const event = await prisma.stripeEvent.findUnique({
      where: { id: eventId },
      select: { id: true },
    });
    return event !== null;
  }

  async recordStripeEvent(eventId: string, type: string) {
    try {
      await prisma.stripeEvent.create({ data: { id: eventId, type } });
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
    }
  }
}
