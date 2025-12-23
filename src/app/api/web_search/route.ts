// 1223 add gpt-realtime + gpt + web_search
import OpenAI from "openai";

export const runtime = "nodejs"; // 確保用 Node runtime

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function POST(req: Request) {
  try {
    const { query, recency_days, domains } = await req.json();

    const input = `請做網路搜尋並回傳：1) 3-6 點重點 2) 來源清單（含標題與URL）。查詢：${query}`;

    const response = await client.responses.create({
      model: "gpt-5", // 或你要的其他支援 web_search 的 model
      tools: [{ type: "web_search" }],
      input,
      // 你也可以在 prompt 裡要求只看特定 domain；或使用文件裡提到的 domain filtering 機制 :contentReference[oaicite:5]{index=5}
    });

    // 取出 citations（url_citation annotations）:contentReference[oaicite:6]{index=6}
    const citations: Array<{ title?: string; url?: string }> = [];
    for (const item of response.output ?? []) {
      if (item.type === "message") {
        for (const part of item.content ?? []) {
          for (const ann of part.annotations ?? []) {
            if (ann.type === "url_citation") {
              citations.push({ title: ann.title, url: ann.url });
            }
          }
        }
      }
    }

    return Response.json({
      answer: response.output_text,
      citations: citations.slice(0, 10),
      // sources: response.sources, // 若你的 SDK/版本有提供，可一併回傳完整 sources :contentReference[oaicite:7]{index=7}
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500 });
  }
}
