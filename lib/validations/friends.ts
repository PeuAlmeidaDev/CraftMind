import { z } from "zod";

/** Body schema for POST /api/friends/request */
export const friendRequestSchema = z.object({
  targetUserId: z
    .string()
    .min(1, "targetUserId is required")
    .max(100, "targetUserId is too long"),
});

export type FriendRequestInput = z.infer<typeof friendRequestSchema>;
