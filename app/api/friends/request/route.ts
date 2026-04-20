import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySession, AuthenticationError } from "@/lib/auth/verify-session";
import { rateLimit } from "@/lib/rate-limit";
import { friendRequestSchema } from "@/lib/validations/friends";
import { apiSuccess, apiError } from "@/lib/api-response";
import { emitToUser } from "@/lib/socket-emitter";

export async function POST(request: NextRequest) {
  try {
    // Auth
    const { userId } = await verifySession(request);

    // Rate limit — more restrictive: 5 req / 60s per user
    const rateLimitResult = await rateLimit(`friend-request:${userId}`, {
      maxRequests: 5,
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

    // Parse and validate body
    const body: unknown = await request.json().catch(() => null);

    if (!body) {
      return apiError("Invalid request body", "INVALID_BODY", 400);
    }

    const parsed = friendRequestSchema.safeParse(body);

    if (!parsed.success) {
      return apiError(
        "Invalid data",
        "VALIDATION_ERROR",
        422,
        parsed.error.flatten()
      );
    }

    const { targetUserId } = parsed.data;

    // Cannot send friend request to yourself
    if (targetUserId === userId) {
      return apiError(
        "You cannot send a friend request to yourself",
        "SELF_REQUEST",
        400
      );
    }

    // Verify target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true },
    });

    if (!targetUser) {
      return apiError("User not found", "USER_NOT_FOUND", 404);
    }

    // Check existing friendship in both directions
    const existingFriendship = await prisma.friendship.findFirst({
      where: {
        OR: [
          { senderId: userId, receiverId: targetUserId },
          { senderId: targetUserId, receiverId: userId },
        ],
      },
    });

    if (existingFriendship) {
      if (existingFriendship.status === "PENDING") {
        return apiError(
          "A pending friend request already exists between you and this user",
          "REQUEST_ALREADY_PENDING",
          409
        );
      }

      if (existingFriendship.status === "ACCEPTED") {
        return apiError(
          "You are already friends with this user",
          "ALREADY_FRIENDS",
          409
        );
      }

      if (existingFriendship.status === "BLOCKED") {
        return apiError(
          "This friend request cannot be sent",
          "REQUEST_BLOCKED",
          403
        );
      }

      // DECLINED — delete old and allow re-sending
      if (existingFriendship.status === "DECLINED") {
        await prisma.friendship.delete({
          where: { id: existingFriendship.id },
        });
      }
    }

    // Create new friendship request
    const friendship = await prisma.friendship.create({
      data: {
        senderId: userId,
        receiverId: targetUserId,
        status: "PENDING",
      },
      select: { id: true },
    });

    // Fetch sender info for the notification payload
    const sender = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        character: { select: { level: true } },
      },
    });

    // Fire-and-forget: notify receiver if online
    if (sender) {
      emitToUser(targetUserId, "friend:request-received", {
        friendshipId: friendship.id,
        sender: {
          id: sender.id,
          name: sender.name,
          level: sender.character?.level ?? 1,
        },
      }).catch(() => {
        // Swallowed — emitToUser already handles errors internally
      });
    }

    return apiSuccess({ friendshipId: friendship.id }, 201);
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return apiError(error.message, error.code, error.statusCode);
    }

    console.error("[POST /api/friends/request]", error);
    return apiError("Internal server error", "INTERNAL_ERROR", 500);
  }
}
