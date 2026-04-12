import { NextRequest } from "next/server";
import { verifySession, AuthenticationError } from "@/lib/auth/verify-session";
import { apiSuccess, apiError } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { cloudinary } from "@/lib/cloudinary";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(request: NextRequest) {
  try {
    const { userId } = await verifySession(request);

    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return apiError("Arquivo nao enviado", "FILE_REQUIRED", 422);
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return apiError(
        "Tipo de arquivo invalido. Aceitos: JPEG, PNG, WebP",
        "INVALID_MIME_TYPE",
        422
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return apiError(
        "Arquivo excede o tamanho maximo de 5MB",
        "FILE_TOO_LARGE",
        422
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64DataUri = `data:${file.type};base64,${buffer.toString("base64")}`;

    const result = await cloudinary.uploader.upload(base64DataUri, {
      folder: "craft-mind/avatars",
      public_id: `avatar-${userId}`,
      overwrite: true,
      transformation: [
        { width: 256, height: 256, crop: "fill", gravity: "face" },
      ],
    });

    await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: result.secure_url },
    });

    return apiSuccess({ avatarUrl: result.secure_url });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return apiError(error.message, error.code, error.statusCode);
    }

    console.error("[POST /api/user/avatar]", error);
    return apiError("Erro interno do servidor", "INTERNAL_ERROR", 500);
  }
}
