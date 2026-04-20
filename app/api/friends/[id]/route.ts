import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySession, AuthenticationError } from "@/lib/auth/verify-session";
import { rateLimit } from "@/lib/rate-limit";
import { apiSuccess, apiError } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    // Auth
    const { userId } = await verifySession(request);

    // Rate limit — standard: 10 req / 60s
    const rateLimitResult = await rateLimit(`friend-delete:${userId}`, {
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
      return apiError("Friendship not found", "NOT_FOUND", 404);
    }

    // User must be sender or receiver
    if (friendship.senderId !== userId && friendship.receiverId !== userId) {
      return apiError(
        "You are not authorized to remove this friendship",
        "FORBIDDEN",
        403
      );
    }

    // Can only remove accepted friendships
    if (friendship.status !== "ACCEPTED") {
      return apiError(
        "Only accepted friendships can be removed",
        "NOT_ACCEPTED",
        400
      );
    }

    // Delete
    await prisma.friendship.delete({
      where: { id: friendshipId },
    });

    return apiSuccess({ removed: true });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return apiError(error.message, error.code, error.statusCode);
    }

    console.error("[DELETE /api/friends/[id]]", error);
    return apiError("Internal server error", "INTERNAL_ERROR", 500);
  }
}
