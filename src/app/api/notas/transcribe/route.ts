import { NextResponse, type NextRequest } from "next/server";
import { getAuthContext } from "@/lib/api/auth";

// Transcripción de notas de voz vía Groq (OpenAI-compatible Whisper).
// Requiere GROQ_API_KEY en el entorno. Modelo configurable con GROQ_STT_MODEL.
const GROQ_STT_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
const GROQ_STT_MODEL = process.env.GROQ_STT_MODEL ?? "whisper-large-v3";
const MAX_SIZE = 25 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    await getAuthContext();

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Falta GROQ_API_KEY en el entorno" }, { status: 503 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No se envió audio" }, { status: 400 });
    if (file.size === 0) return NextResponse.json({ error: "El audio está vacío" }, { status: 400 });
    if (file.size > MAX_SIZE) return NextResponse.json({ error: "El audio excede 25MB" }, { status: 400 });

    const groqForm = new FormData();
    groqForm.append("file", file, file.name || "audio.webm");
    groqForm.append("model", GROQ_STT_MODEL);
    groqForm.append("language", "es");
    groqForm.append("response_format", "text");

    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 60_000);
    try {
      const res = await fetch(GROQ_STT_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: groqForm,
        signal: ctrl.signal,
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        console.error("[Notas Transcribe] Groq error:", res.status, txt.slice(0, 300));
        return NextResponse.json({ error: `Error de transcripción (${res.status})` }, { status: 502 });
      }
      const text = (await res.text()).trim();
      return NextResponse.json({ text });
    } finally {
      clearTimeout(timeout);
    }
  } catch (err) {
    console.error("[Notas Transcribe] Error:", err);
    return NextResponse.json({ error: "Error al transcribir el audio" }, { status: 500 });
  }
}
