// 1223 add gpt-realtime + gpt + web_search
import OpenAI from "openai";

export const runtime = "nodejs";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

type WebSearchReq = {
  query: string;
  recency_days?: number;
  domains?: string[];
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as WebSearchReq;

    const query = String(body?.query || "").trim();
    const recency_days = Number.isFinite(body?.recency_days) ? Number(body.recency_days) : 30;
    const domains = Array.isArray(body?.domains) ? body.domains.filter(Boolean).map(String) : [];

    if (!query) {
      return Response.json({ error: "Missing required field: query" }, { status: 400 });
    }

    // ✅ 把 recency_days / domains 真正用到（避免 ESLint unused）
    const domainHint =
      domains.length > 0 ? `\n- 優先只使用這些網域：${domains.join(", ")}` : "";
    const recencyHint =
      recency_days > 0 ? `\n- 優先參考最近 ${recency_days} 天內的資訊（若可取得）` : "";

    const input = `你是一個搜尋助理。請先做網路搜尋，再以繁體中文整理結果。

需求：
- 先列出 3-6 個重點（條列）
- 再列出來源（每筆包含：title + url）
- 若來源之間資訊互相矛盾，請指出並以較可靠來源為主

查詢：${query}${recencyHint}${domainHint}`;

    const response = await client.responses.create({
      // ✅ 你也可以改成你想用的可用模型
      model: "gpt-5",
      tools: [{ type: "web_search" }],
      input,
    });

    // ✅ 抽 citations（url_citation annotations）
    const citations: Array<{ title?: string; url?: string }> = [];
    for (const item of response.output ?? []) {
      if (item.type === "message") {
        for (const part of item.content ?? []) {
          for (const ann of (part as any).annotations ?? []) {
            if (ann?.type === "url_citation") {
              citations.push({ title: ann.title, url: ann.url });
            }
          }
        }
      }
    }

    return Response.json({
      answer: response.output_text,
      citations: citations.slice(0, 10),
      meta: {
        query,
        recency_days,
        domains,
      },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500 });
  }
}

