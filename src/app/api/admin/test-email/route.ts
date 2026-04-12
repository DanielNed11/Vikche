import { AppError, getErrorMessage } from "@/lib/http-error";
import { sendTestEmail } from "@/lib/notifier";
import { getOptionalViewer, requireViewer } from "@/lib/viewer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function hasAdminBearerAuth(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();

  if (!cronSecret) {
    return false;
  }

  return request.headers.get("authorization") === `Bearer ${cronSecret}`;
}

export async function POST(request: Request) {
  try {
    if (hasAdminBearerAuth(request)) {
      await getOptionalViewer();
    } else {
      await requireViewer();
    }

    const result = await sendTestEmail();

    return Response.json(result, {
      status: 200,
    });
  } catch (error) {
    const status = error instanceof AppError ? error.status : 500;

    return Response.json(
      {
        error: getErrorMessage(error),
      },
      {
        status,
      },
    );
  }
}
