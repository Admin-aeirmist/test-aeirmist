export interface NewsArticle {
  title: string;
  description: string;
  url: string;
  image: string;
  publishedAt: string;
  source: string;
}

export async function fetchTopNews(category = 'general'): Promise<NewsArticle[]> {
  try {
    const rssUrls: Record<string, string> = {
      general: 'https://feeds.bbci.co.uk/news/rss.xml',
      technology: 'https://feeds.bbci.co.uk/news/technology/rss.xml',
      sports: 'https://feeds.bbci.co.uk/sport/rss.xml',
      bangladesh: 'https://www.thedailystar.net/feed/news',
    };
    const rssUrl = rssUrls[category] || rssUrls.general;
    const res = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}&count=10`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.items || []).map((item: any) => ({
      title: item.title || '',
      description: item.description?.replace(/<[^>]*>/g, '').slice(0, 120) || '',
      url: item.link || '',
      image: item.enclosure?.link || item.thumbnail || '',
      publishedAt: item.pubDate || '',
      source: data.feed?.title || 'News',
    }));
  } catch {
    return [];
  }
}
