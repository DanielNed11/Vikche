import { refreshWatch } from "@/lib/watch-service";
import { AppError, getErrorMessage } from "@/lib/http-error";
import { requireViewer } from "@/lib/viewer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  context: RouteContext<"/api/watchlist/items/[id]/refresh">,
) {
  try {
    const viewer = await requireViewer();
    const { id } = await context.params;
    const result = await refreshWatch(viewer.id, id);

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
