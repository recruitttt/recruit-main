export const WEB_SEARCH_TOOL_DEF = {
  type: "function" as const,
  function: {
    name: "web_search",
    description: "Search the web for current information about a company. Use this for questions about company news, leadership, recent funding, products, culture.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query, e.g., 'Stripe recent funding 2026'" },
      },
      required: ["query"],
    },
  },
};

export type WebSearchResult = {
  title: string;
  url: string;
  snippet: string;
};

export async function executeWebSearch(query: string): Promise<WebSearchResult[]> {
  const tavilyKey = process.env.TAVILY_API_KEY;
  if (tavilyKey) {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: tavilyKey, query, max_results: 5 }),
    });
    if (!res.ok) throw new Error(`Tavily ${res.status}`);
    const data = await res.json();
    return (data.results ?? []).map((r: { title: string; url: string; content: string }) => ({
      title: r.title,
      url: r.url,
      snippet: r.content,
    }));
  }
  throw new Error("No web search backend configured (set TAVILY_API_KEY or wire OpenAI native).");
}

export function formatWebSearchResults(results: WebSearchResult[]): string {
  return results.map((r, i) => `[${i + 1}] ${r.title}\n${r.url}\n${r.snippet}`).join("\n\n");
}
