import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySession, AuthenticationError } from "@/lib/auth/verify-session";
import { rateLimit } from "@/lib/rate-limit";
import { apiSuccess, apiError } from "@/lib/api-response";
import { emitToUser } from "@/lib/socket-emitter";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    // Auth
    const { userId } = await verifySession(request);

    // Rate limit — standard: 10 req / 60s
    const rateLimitResult = await rateLimit(`friend-accept:${userId}`, {
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

    const { id: friendshipId } = await params;

    if (!friendshipId) {
      return apiError("Friendship ID is required", "MISSING_ID", 400);
    }

    // Find the friendship
    const friendship = await prisma.friendship.findUnique({
      where: { id: friendshipId },
      select: { id: true, senderId: true, receiverId: true, status: true },
    });

    if (!friendship) {
      return apiError("Friend request not found", "NOT_FOUND", 404);
    }

    // Only the receiver can accept
    if (friendship.receiverId !== userId) {
      return apiError(
        "You are not authorized to accept this request",
        "FORBIDDEN",
        403
      );
    }

    // Must be PENDING
    if (friendship.status !== "PENDING") {
      return apiError(
        "This friend request is no longer pending",
        "NOT_PENDING",
        400
      );
    }

    // Accept
    await prisma.friendship.update({
      where: { id: friendshipId },
      data: { status: "ACCEPTED" },
    });

    // Fetch accepter info for the notification payload
    const accepter = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        character: { select: { level: true } },
      },
    });

    // Fire-and-forget: notify the original sender if online
    if (accepter) {
      emitToUser(friendship.senderId, "friend:request-accepted", {
        friendshipId: friendship.id,
        friend: {
          id: accepter.id,
          name: accepter.name,
          level: accepter.character?.level ?? 1,
        },
      }).catch(() => {
        // Swallowed — emitToUser already handles errors internally
      });
    }

    return apiSuccess({ accepted: true });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return apiError(error.message, error.code, error.statusCode);
    }

    console.error("[PUT /api/friends/request/[id]/accept]", error);
    return apiError("Internal server error", "INTERNAL_ERROR", 500);
  }
}
