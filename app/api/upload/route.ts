import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

function isValidCode(code: unknown): code is string {
  return typeof code === "string" && /^[A-Z0-9]{4,12}$/.test(code);
}

const MAX_BYTES = 20 * 1024 * 1024; // 20 MB

export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        let code: unknown;
        try {
          code = JSON.parse(clientPayload ?? "{}").code;
        } catch {
          throw new Error("Ogiltig uppladdningsdata");
        }

        if (!isValidCode(code)) throw new Error("Ogiltig synk-kod");
        if (!pathname.startsWith(`sync/${code}/audio/`)) throw new Error("Ogiltig sökväg");

        return {
          allowedContentTypes: ["audio/*", "application/octet-stream"],
          maximumSizeInBytes: MAX_BYTES,
          addRandomSuffix: false,
          tokenPayload: JSON.stringify({ code }),
        };
      },
      onUploadCompleted: async () => {
        // Ingen extra serveråtgärd behövs. URL:en sparas i appens synkade state.
      },
    });

    return Response.json(jsonResponse);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Uppladdningen misslyckades" },
      { status: 400 },
    );
  }
}
