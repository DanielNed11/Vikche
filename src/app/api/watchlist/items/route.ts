import { createWatch, getDashboardData } from "@/lib/watch-service";
import { AppError, getErrorMessage } from "@/lib/http-error";
import { requireViewer } from "@/lib/viewer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const viewer = await requireViewer();
  const dashboard = await getDashboardData(viewer.id);
  return Response.json(dashboard);
}

export async function POST(request: Request) {
  try {
    const viewer = await requireViewer();
    const body = (await request.json()) as {
      url?: string;
      variantCode?: string;
    };
    const result = await createWatch(viewer.id, body.url ?? "", body.variantCode);

    return Response.json(result, {
      status: result.duplicate ? 200 : 201,
    });
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
