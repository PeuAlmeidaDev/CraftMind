import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import { cloudinary } from "@/lib/cloudinary";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const card = await prisma.card.findUnique({ where: { id } });
    if (!card) return apiError("Card nao encontrado", "NOT_FOUND", 404);

    const formData = await request.formData();
    const file = formData.get("image") ?? formData.get("file");

    if (!file || !(file instanceof File)) {
      return apiError("Imagem nao enviada", "FILE_REQUIRED", 422);
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return apiError(
        "Tipo invalido. Aceitos: JPEG, PNG, WebP, GIF (so lendarias)",
        "INVALID_MIME_TYPE",
        422,
      );
    }

    if (file.type === "image/gif" && card.requiredStars !== 3) {
      return apiError(
        "GIF animado e exclusivo de cartas 3 estrelas",
        "STARS_LOCKED",
        422,
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return apiError("Arquivo excede 10MB", "FILE_TOO_LARGE", 422);
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64DataUri = `data:${file.type};base64,${buffer.toString("base64")}`;

    const result = await cloudinary.uploader.upload(base64DataUri, {
      folder: "craft-mind/cards",
      public_id: `card-${id}`,
      overwrite: true,
      resource_type: "image",
      eager: [
        {
          width: 768,
          height: 1024,
          crop: "fill",
          quality: "auto",
          fetch_format: "auto",
        },
      ],
      timeout: 120000,
    });

    const finalUrl = result.eager?.[0]?.secure_url ?? result.secure_url;

    const updated = await prisma.card.update({
      where: { id },
      data: { cardArtUrl: finalUrl },
    });

    return apiSuccess(updated);
  } catch (error) {
    const err = error as { message?: string; http_code?: number; name?: string };
    console.error("[POST /api/admin/cards/:id/image]", {
      name: err.name,
      message: err.message,
      httpCode: err.http_code,
    });
    return apiError("Erro interno do servidor", "INTERNAL_ERROR", 500);
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const card = await prisma.card.findUnique({ where: { id } });
    if (!card) return apiError("Card nao encontrado", "NOT_FOUND", 404);

    if (!card.cardArtUrl) {
      return apiError("Card nao possui imagem", "NO_IMAGE", 422);
    }

    try {
      await cloudinary.uploader.destroy(`craft-mind/cards/card-${id}`);
    } catch {
      // Cloudinary destroy pode falhar se a imagem ja foi removida — ignorar.
    }

    const updated = await prisma.card.update({
      where: { id },
      data: { cardArtUrl: null },
    });

    return apiSuccess(updated);
  } catch (error) {
    console.error("[DELETE /api/admin/cards/:id/image]", error);
    return apiError("Erro interno do servidor", "INTERNAL_ERROR", 500);
  }
}
