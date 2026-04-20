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
    const rateLimitResult = await rateLimit(`friends-list:${userId}`, {
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

    // List all accepted friendships for the authenticated user
    const friendships = await prisma.friendship.findMany({
      where: {
        status: "ACCEPTED",
        OR: [{ senderId: userId }, { receiverId: userId }],
      },
      select: {
        id: true,
        updatedAt: true,
        senderId: true,
        receiverId: true,
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
        receiver: {
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
      orderBy: { updatedAt: "desc" },
    });

    // For each friendship, return the OTHER user's data
    const friends = friendships.map((fr) => {
      const otherUser =
        fr.senderId === userId ? fr.receiver : fr.sender;

      return {
        friendshipId: fr.id,
        updatedAt: fr.updatedAt,
        user: {
          id: otherUser.id,
          name: otherUser.name,
          level: otherUser.character?.level ?? 1,
          houseName: otherUser.house?.name ?? null,
        },
      };
    });

    return apiSuccess(friends);
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return apiError(error.message, error.code, error.statusCode);
    }

    console.error("[GET /api/friends]", error);
    return apiError("Internal server error", "INTERNAL_ERROR", 500);
  }
}
