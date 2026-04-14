import { NextRequest } from "next/server";
import { verifySession, AuthenticationError } from "@/lib/auth/verify-session";
import { apiSuccess, apiError } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import type { CalendarDay } from "@/types/task";

type CalendarRow = {
  date: Date;
  total: number;
  completed: number;
};

export async function GET(request: NextRequest) {
  try {
    const { userId } = await verifySession(request);

    const from = request.nextUrl.searchParams.get("from");
    const to = request.nextUrl.searchParams.get("to");

    if (!from || !to) {
      return apiError(
        "Parametros 'from' e 'to' sao obrigatorios",
        "MISSING_PARAMS",
        400,
      );
    }

    const fromDate = new Date(from);
    const toDate = new Date(to);

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return apiError(
        "Parametros 'from' e 'to' devem ser datas validas (ISO 8601)",
        "INVALID_DATE",
        400,
      );
    }

    if (fromDate > toDate) {
      return apiError(
        "'from' deve ser anterior ou igual a 'to'",
        "INVALID_RANGE",
        400,
      );
    }

    const diffMs = toDate.getTime() - fromDate.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (diffDays > 120) {
      return apiError(
        "Intervalo maximo de 120 dias",
        "RANGE_TOO_LARGE",
        400,
      );
    }

    // SQL raw justificado: Prisma nao suporta GROUP BY com FILTER.
    // Parametros escapados via Prisma.sql (sem risco de SQL injection).
    const rows = await prisma.$queryRaw<CalendarRow[]>(
      Prisma.sql`
        SELECT
          "dueDate"::date as date,
          COUNT(*)::int as total,
          COUNT(*) FILTER (WHERE completed = true)::int as completed
        FROM "DailyTask"
        WHERE "userId" = ${userId}
          AND "dueDate" >= ${fromDate}
          AND "dueDate" <= ${toDate}
        GROUP BY "dueDate"::date
        ORDER BY date ASC
      `,
    );

    const days: CalendarDay[] = rows.map((row) => ({
      date: row.date.toISOString().split("T")[0],
      completed: row.completed,
      total: row.total,
    }));

    return apiSuccess({ days });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return apiError(error.message, error.code, error.statusCode);
    }
    console.error("[GET /api/tasks/calendar]", error);
    return apiError("Erro interno do servidor", "INTERNAL_ERROR", 500);
  }
}
