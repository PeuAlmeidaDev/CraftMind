import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySession, AuthenticationError } from "@/lib/auth/verify-session";
import { rateLimit } from "@/lib/rate-limit";
import { apiSuccess, apiError } from "@/lib/api-response";
import type { FriendshipStatus } from "@prisma/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FriendshipStatusNone {
  status: "NONE";
}

interface FriendshipStatusExists {
  status: FriendshipStatus;
  friendshipId: string;
  direction: "SENT" | "RECEIVED";
}

type FriendshipStatusResponse = FriendshipStatusNone | FriendshipStatusExists;

// ---------------------------------------------------------------------------
// GET /api/friends/status/[userId]
// ---------------------------------------------------------------------------

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    // Auth
    const { userId: myId } = await verifySession(request);

    // Rate limit — standard: 10 req / 60s
    const rateLimitResult = await rateLimit(`friend-status:${myId}`, {
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

    // Validate path param
    const { userId: targetUserId } = await params;

    if (!targetUserId || targetUserId.trim() === "") {
      return apiError("User ID is required", "INVALID_PARAM", 400);
    }

    // Cannot look up yourself
    if (targetUserId === myId) {
      return apiError(
        "Cannot check friendship status with yourself",
        "SELF_LOOKUP",
        400
      );
    }

    // Find existing friendship in either direction
    const friendship = await prisma.friendship.findFirst({
      where: {
        OR: [
          { senderId: myId, receiverId: targetUserId },
          { senderId: targetUserId, receiverId: myId },
        ],
      },
      select: {
        id: true,
        senderId: true,
        status: true,
      },
    });

    if (!friendship) {
      const response: FriendshipStatusNone = { status: "NONE" };
      return apiSuccess(response);
    }

    const direction: "SENT" | "RECEIVED" =
      friendship.senderId === myId ? "SENT" : "RECEIVED";

    const response: FriendshipStatusExists = {
      status: friendship.status,
      friendshipId: friendship.id,
      direction,
    };

    return apiSuccess(response);
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return apiError(error.message, error.code, error.statusCode);
    }

    console.error("[GET /api/friends/status/[userId]]", error);
    return apiError("Internal server error", "INTERNAL_ERROR", 500);
  }
}
