import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import { cloudinary } from "@/lib/cloudinary";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const mob = await prisma.mob.findUnique({ where: { id } });
    if (!mob) return apiError("Mob nao encontrado", "NOT_FOUND", 404);

    const formData = await request.formData();
    const file = formData.get("image");

    if (!file || !(file instanceof File)) {
      return apiError("Imagem nao enviada", "FILE_REQUIRED", 422);
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return apiError("Tipo invalido. Aceitos: JPEG, PNG, WebP", "INVALID_MIME_TYPE", 422);
    }

    if (file.size > MAX_FILE_SIZE) {
      return apiError("Arquivo excede 5MB", "FILE_TOO_LARGE", 422);
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64DataUri = `data:${file.type};base64,${buffer.toString("base64")}`;

    const result = await cloudinary.uploader.upload(base64DataUri, {
      folder: "craft-mind/mobs",
      public_id: `mob-${id}`,
      overwrite: true,
      transformation: [{ width: 512, height: 512, crop: "fill" }],
    });

    const updated = await prisma.mob.update({
      where: { id },
      data: { imageUrl: result.secure_url },
    });

    return apiSuccess(updated);
  } catch (error) {
    console.error("[POST /api/admin/mobs/:id/image]", error);
    return apiError("Erro interno do servidor", "INTERNAL_ERROR", 500);
  }
}
