import { resolveDouglasProduct } from "@/lib/douglas/connector";
import { AppError, getErrorMessage } from "@/lib/http-error";
import { requireViewer } from "@/lib/viewer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await requireViewer();
    const body = (await request.json()) as { url?: string };
    const result = await resolveDouglasProduct(body.url ?? "");

    return Response.json(result);
  } catch (error) {
    const status = error instanceof AppError ? error.status : 500;

    return Response.json(
      {
        error: getErrorMessage(error),
      },
      { status },
    );
  }
}
