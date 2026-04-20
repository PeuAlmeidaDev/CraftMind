import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySession, AuthenticationError } from "@/lib/auth/verify-session";
import { rateLimit } from "@/lib/rate-limit";
import { apiSuccess, apiError } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    // Auth
    const { userId } = await verifySession(request);

    // Rate limit — standard: 10 req / 60s
    const rateLimitResult = await rateLimit(`friend-decline:${userId}`, {
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
      select: { id: true, receiverId: true, status: true },
    });

    if (!friendship) {
      return apiError("Friend request not found", "NOT_FOUND", 404);
    }

    // Only the receiver can decline
    if (friendship.receiverId !== userId) {
      return apiError(
        "You are not authorized to decline this request",
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

    // Decline
    await prisma.friendship.update({
      where: { id: friendshipId },
      data: { status: "DECLINED" },
    });

    return apiSuccess({ declined: true });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return apiError(error.message, error.code, error.statusCode);
    }

    console.error("[PUT /api/friends/request/[id]/decline]", error);
    return apiError("Internal server error", "INTERNAL_ERROR", 500);
  }
}
