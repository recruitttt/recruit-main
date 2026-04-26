import { request } from "undici";
import * as cheerio from "cheerio";
import type { Achievement } from "@/lib/intake/shared";

export async function fetchAchievements(login: string): Promise<Achievement[]> {
  try {
    const res = await request(`https://github.com/${encodeURIComponent(login)}`, {
      method: "GET",
      headers: { "user-agent": "gh-applicant/0.1 (+https://github.com)" },
    });
    if (res.statusCode !== 200) return [];
    const html = await res.body.text();
    const $ = cheerio.load(html);
    const out: Achievement[] = [];
    $('a[href*="/achievements/"]').each((_, el) => {
      const href = $(el).attr("href") ?? "";
      const slugMatch = href.match(/\/achievements\/([^/?#]+)/);
      if (!slugMatch?.[1]) return;
      const slug = slugMatch[1];
      const img = $(el).find("img").first();
      const name = $(el).attr("aria-label") ?? img.attr("alt") ?? slug;
      const rawSrc = img.attr("src");
      const imageUrl = rawSrc && rawSrc.startsWith("https://") ? rawSrc : undefined;
      out.push({ slug, name, imageUrl });
    });
    const seen = new Set<string>();
    return out.filter((a) => (seen.has(a.slug) ? false : (seen.add(a.slug), true)));
  } catch {
    return [];
  }
}
