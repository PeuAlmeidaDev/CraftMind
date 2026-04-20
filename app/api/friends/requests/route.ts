import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySession, AuthenticationError } from "@/lib/auth/verify-session";
import { rateLimit } from "@/lib/rate-limit";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function GET(request: NextRequest) {
  try {
    // Auth
    const { userId } = await verifySession(request);

    // Rate limit — standard: 10 req / 60s
    const rateLimitResult = await rateLimit(`friend-requests-list:${userId}`, {
      maxRequests: 10,
      window: "60 s",
    });

    if (!rateLimitResult.success) {
      const response = apiError(
        "Too many requests. Try again later.",
        "RATE_LIMIT_EXCEEDED",
        429
      );
      response.headers.set(
        "Retry-After",
        String(Math.ceil((rateLimitResult.reset - Date.now()) / 1000))
      );
      return response;
    }

    // List pending friend requests received by the authenticated user
    const pendingRequests = await prisma.friendship.findMany({
      where: {
        receiverId: userId,
        status: "PENDING",
      },
      select: {
        id: true,
        createdAt: true,
        sender: {
          select: {
            id: true,
            name: true,
            house: {
              select: {
                name: true,
              },
            },
            character: {
              select: {
                level: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const formatted = pendingRequests.map((fr) => ({
      id: fr.id,
      createdAt: fr.createdAt,
      sender: {
        id: fr.sender.id,
        name: fr.sender.name,
        level: fr.sender.character?.level ?? 1,
        houseName: fr.sender.house?.name ?? null,
      },
    }));

    return apiSuccess(formatted);
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return apiError(error.message, error.code, error.statusCode);
    }

    console.error("[GET /api/friends/requests]", error);
    return apiError("Internal server error", "INTERNAL_ERROR", 500);
  }
}
