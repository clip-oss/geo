/**
 * Site Analyzer — Ported from geo-seo-claude Python scripts.
 * Fetches a website URL and analyzes:
 *   - Citability scoring (passage quality, definition patterns, statistical density)
 *   - AI crawler access via robots.txt
 *   - Schema markup detection (JSON-LD, microdata)
 *   - llms.txt detection
 *   - Basic content quality signals
 */

// ── Types ──────────────────────────────────────────────────────────────────

export interface SiteAnalysisResult {
  citabilityScore: number; // 0-100
  crawlerScore: number; // 0-100
  schemaScore: number; // 0-100
  contentQualityScore: number; // 0-100
  crawlerDetails: CrawlerDetail[];
  schemaTypes: string[];
  hasLlmsTxt: boolean;
  hasLlmsFullTxt: boolean;
  findings: Finding[];
  quickWins: string[];
}

export interface CrawlerDetail {
  name: string;
  status: "ALLOWED" | "BLOCKED" | "PARTIALLY_BLOCKED" | "NOT_MENTIONED" | "NO_ROBOTS_TXT";
}

export interface Finding {
  severity: "critical" | "high" | "medium" | "low";
  category: string;
  message: string;
}

// ── AI Crawlers to check ───────────────────────────────────────────────────

const AI_CRAWLERS = [
  "GPTBot",
  "ChatGPT-User",
  "ClaudeBot",
  "anthropic-ai",
  "PerplexityBot",
  "Google-Extended",
  "Bytespider",
  "cohere-ai",
];

// ── Citability Scorer (ported from citability_scorer.py) ───────────────────

function scorePassage(text: string, heading?: string): number {
  const words = text.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  let abqScore = 0; // Answer Block Quality (30%)
  let scScore = 0; // Self-Containment (25%)
  let srScore = 0; // Structural Readability (20%)
  let sdScore = 0; // Statistical Density (15%)
  let usScore = 0; // Uniqueness Signals (10%)

  // === 1. Answer Block Quality (30%) ===
  const definitionPatterns = [
    /\b\w+\s+is\s+(?:a|an|the)\s/i,
    /\b\w+\s+refers?\s+to\s/i,
    /\b\w+\s+means?\s/i,
    /\b\w+\s+(?:can be |are )?defined\s+as\s/i,
    /\bin\s+(?:simple|other)\s+(?:terms|words)\s*,/i,
  ];
  for (const pattern of definitionPatterns) {
    if (pattern.test(text)) {
      abqScore += 15;
      break;
    }
  }

  const first60Words = words.slice(0, 60).join(" ");
  if (
    /\b(?:is|are|was|were|means?|refers?)\b/i.test(first60Words) ||
    /\d+%/.test(first60Words) ||
    /\$[\d,]+/.test(first60Words) ||
    /\d+\s+(?:million|billion|thousand)/i.test(first60Words)
  ) {
    abqScore += 15;
  }

  if (heading && heading.endsWith("?")) {
    abqScore += 10;
  }

  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const shortClearSentences = sentences.filter((s) => {
    const wc = s.trim().split(/\s+/).length;
    return wc >= 5 && wc <= 25;
  }).length;
  if (sentences.length > 0) {
    const clarityRatio = shortClearSentences / sentences.length;
    abqScore += Math.floor(clarityRatio * 10);
  }

  if (
    /(?:according to|research shows|studies?\s+(?:show|indicate|suggest|found)|data\s+(?:shows|indicates|suggests))/i.test(
      text
    )
  ) {
    abqScore += 10;
  }

  abqScore = Math.min(abqScore, 30);

  // === 2. Self-Containment (25%) ===
  if (wordCount >= 134 && wordCount <= 167) {
    scScore += 10;
  } else if (wordCount >= 100 && wordCount <= 200) {
    scScore += 7;
  } else if (wordCount >= 80 && wordCount <= 250) {
    scScore += 4;
  } else if (wordCount >= 30 && wordCount <= 400) {
    scScore += 2;
  }

  const pronounCount = (
    text.match(
      /\b(?:it|they|them|their|this|that|these|those|he|she|his|her)\b/gi
    ) || []
  ).length;
  if (wordCount > 0) {
    const pronounRatio = pronounCount / wordCount;
    if (pronounRatio < 0.02) scScore += 8;
    else if (pronounRatio < 0.04) scScore += 5;
    else if (pronounRatio < 0.06) scScore += 3;
  }

  const properNouns = (text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || []).length;
  if (properNouns >= 3) scScore += 7;
  else if (properNouns >= 1) scScore += 4;

  scScore = Math.min(scScore, 25);

  // === 3. Structural Readability (20%) ===
  if (sentences.length > 0) {
    const avgSentenceLength = wordCount / sentences.length;
    if (avgSentenceLength >= 10 && avgSentenceLength <= 20) srScore += 8;
    else if (avgSentenceLength >= 8 && avgSentenceLength <= 25) srScore += 5;
    else srScore += 2;
  }

  if (
    /(?:first|second|third|finally|additionally|moreover|furthermore)/i.test(
      text
    )
  ) {
    srScore += 4;
  }

  if (/(?:\d+[.)]\s|\b(?:step|tip|point)\s+\d+)/i.test(text)) {
    srScore += 4;
  }

  if (text.includes("\n")) {
    srScore += 4;
  }

  srScore = Math.min(srScore, 20);

  // === 4. Statistical Density (15%) ===
  const pctCount = (text.match(/\d+(?:\.\d+)?%/g) || []).length;
  sdScore += Math.min(pctCount * 3, 6);

  const dollarCount = (
    text.match(/\$[\d,]+(?:\.\d+)?(?:\s*(?:million|billion|M|B|K))?/g) || []
  ).length;
  sdScore += Math.min(dollarCount * 3, 5);

  const numberCount = (
    text.match(
      /\b\d+(?:,\d{3})*(?:\.\d+)?\s+(?:users|customers|pages|sites|companies|businesses|people|percent|times|x\b)/gi
    ) || []
  ).length;
  sdScore += Math.min(numberCount * 2, 4);

  if (/\b20(?:2[3-6]|1\d)\b/.test(text)) {
    sdScore += 2;
  }

  const sourcePatterns = [
    /(?:according to|per|from|by)\s+[A-Z]/,
    /(?:Gartner|Forrester|McKinsey|Harvard|Stanford|MIT|Google|Microsoft|OpenAI|Anthropic)/,
    /\([A-Z][a-z]+(?:\s+\d{4})?\)/,
  ];
  for (const pattern of sourcePatterns) {
    if (pattern.test(text)) {
      sdScore += 2;
    }
  }

  sdScore = Math.min(sdScore, 15);

  // === 5. Uniqueness Signals (10%) ===
  if (
    /(?:our\s+(?:research|study|data|analysis|survey|findings)|we\s+(?:found|discovered|analyzed|surveyed|measured))/i.test(
      text
    )
  ) {
    usScore += 5;
  }

  if (
    /(?:case study|for example|for instance|in practice|real-world|hands-on)/i.test(
      text
    )
  ) {
    usScore += 3;
  }

  if (/(?:using|with|via|through)\s+[A-Z][a-z]+/.test(text)) {
    usScore += 2;
  }

  usScore = Math.min(usScore, 10);

  return abqScore + scScore + srScore + sdScore + usScore;
}

// ── HTML Content Extraction ────────────────────────────────────────────────

function extractTextBlocks(html: string): { heading: string; content: string }[] {
  const blocks: { heading: string; content: string }[] = [];

  // Strip script, style, nav, footer, header, aside, form tags and their content
  let cleaned = html;
  for (const tag of ["script", "style", "nav", "footer", "header", "aside", "form"]) {
    const regex = new RegExp(`<${tag}[^>]*>[\\s\\S]*?</${tag}>`, "gi");
    cleaned = cleaned.replace(regex, "");
  }

  // Extract sections by headings
  const headingRegex = /<h([1-4])[^>]*>([\s\S]*?)<\/h\1>/gi;
  const headings: { index: number; text: string }[] = [];
  let match;

  while ((match = headingRegex.exec(cleaned)) !== null) {
    const text = match[2].replace(/<[^>]+>/g, "").trim();
    if (text) {
      headings.push({ index: match.index, text });
    }
  }

  // Extract content between headings
  for (let i = 0; i < headings.length; i++) {
    const start = headings[i].index;
    const end = i + 1 < headings.length ? headings[i + 1].index : cleaned.length;
    const section = cleaned.substring(start, end);

    // Extract paragraph text from section
    const paragraphs: string[] = [];
    const pRegex = /<(?:p|li|td|blockquote)[^>]*>([\s\S]*?)<\/(?:p|li|td|blockquote)>/gi;
    let pMatch;
    while ((pMatch = pRegex.exec(section)) !== null) {
      const pText = pMatch[1].replace(/<[^>]+>/g, "").trim();
      if (pText && pText.split(/\s+/).length >= 5) {
        paragraphs.push(pText);
      }
    }

    if (paragraphs.length > 0) {
      const combined = paragraphs.join(" ");
      if (combined.split(/\s+/).length >= 20) {
        blocks.push({ heading: headings[i].text, content: combined });
      }
    }
  }

  // If no heading-based blocks found, try to extract any paragraph content
  if (blocks.length === 0) {
    const allParagraphs: string[] = [];
    const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
    while ((match = pRegex.exec(cleaned)) !== null) {
      const pText = match[1].replace(/<[^>]+>/g, "").trim();
      if (pText && pText.split(/\s+/).length >= 5) {
        allParagraphs.push(pText);
      }
    }
    if (allParagraphs.length > 0) {
      blocks.push({ heading: "Main Content", content: allParagraphs.join(" ") });
    }
  }

  return blocks;
}

function stripHtml(html: string): string {
  // Remove all tags
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

// ── Robots.txt Parsing (ported from fetch_page.py) ─────────────────────────

function parseRobotsTxt(
  content: string
): Map<string, { directive: string; path: string }[]> {
  const agentRules = new Map<string, { directive: string; path: string }[]>();
  let currentAgent: string | null = null;

  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (line.toLowerCase().startsWith("user-agent:")) {
      currentAgent = line.split(":").slice(1).join(":").trim();
      if (!agentRules.has(currentAgent)) {
        agentRules.set(currentAgent, []);
      }
    } else if (line.toLowerCase().startsWith("disallow:") && currentAgent) {
      const path = line.split(":").slice(1).join(":").trim();
      agentRules.get(currentAgent)!.push({ directive: "Disallow", path });
    } else if (line.toLowerCase().startsWith("allow:") && currentAgent) {
      const path = line.split(":").slice(1).join(":").trim();
      agentRules.get(currentAgent)!.push({ directive: "Allow", path });
    }
  }

  return agentRules;
}

function getCrawlerStatus(
  crawler: string,
  agentRules: Map<string, { directive: string; path: string }[]>
): CrawlerDetail["status"] {
  if (agentRules.has(crawler)) {
    const rules = agentRules.get(crawler)!;
    if (rules.some((r) => r.directive === "Disallow" && r.path === "/")) {
      return "BLOCKED";
    }
    if (rules.some((r) => r.directive === "Disallow" && r.path)) {
      return "PARTIALLY_BLOCKED";
    }
    return "ALLOWED";
  }
  if (agentRules.has("*")) {
    const wildcardRules = agentRules.get("*")!;
    if (wildcardRules.some((r) => r.directive === "Disallow" && r.path === "/")) {
      return "BLOCKED";
    }
  }
  return "NOT_MENTIONED";
}

// ── Schema Detection ───────────────────────────────────────────────────────

function detectSchemaMarkup(html: string): string[] {
  const schemaTypes: string[] = [];

  // JSON-LD detection
  const jsonLdRegex = /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = jsonLdRegex.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1]);
      if (Array.isArray(data)) {
        for (const item of data) {
          if (item["@type"]) {
            const types = Array.isArray(item["@type"]) ? item["@type"] : [item["@type"]];
            schemaTypes.push(...types);
          }
        }
      } else if (data["@graph"]) {
        for (const item of data["@graph"]) {
          if (item["@type"]) {
            const types = Array.isArray(item["@type"]) ? item["@type"] : [item["@type"]];
            schemaTypes.push(...types);
          }
        }
      } else if (data["@type"]) {
        const types = Array.isArray(data["@type"]) ? data["@type"] : [data["@type"]];
        schemaTypes.push(...types);
      }
    } catch {
      // Invalid JSON-LD
    }
  }

  // Microdata detection (itemtype attribute)
  const microdataRegex = /itemtype\s*=\s*["']https?:\/\/schema\.org\/(\w+)["']/gi;
  while ((match = microdataRegex.exec(html)) !== null) {
    schemaTypes.push(match[1]);
  }

  return [...new Set(schemaTypes)];
}

// ── Content Quality Signals ────────────────────────────────────────────────

function scoreContentQuality(html: string): { score: number; findings: Finding[] } {
  const findings: Finding[] = [];
  let score = 50; // Start at baseline

  const stripped = stripHtml(html);
  const wordCount = stripped.split(/\s+/).filter(Boolean).length;

  // Word count check
  if (wordCount > 1000) {
    score += 15;
  } else if (wordCount > 500) {
    score += 8;
  } else if (wordCount < 200) {
    score -= 15;
    findings.push({
      severity: "high",
      category: "Content Quality",
      message: `Very thin content (${wordCount} words). AI models prefer pages with 800+ words of substantive content.`,
    });
  }

  // Check for meta description
  if (/<meta[^>]*name\s*=\s*["']description["'][^>]*content\s*=\s*["']([^"']+)["']/i.test(html)) {
    score += 5;
  } else {
    findings.push({
      severity: "medium",
      category: "Content Quality",
      message: "Missing meta description. Add a 150-160 character description for AI snippet generation.",
    });
  }

  // Check for heading structure
  const h1Count = (html.match(/<h1[^>]*>/gi) || []).length;
  const h2Count = (html.match(/<h2[^>]*>/gi) || []).length;

  if (h1Count === 1) {
    score += 5;
  } else if (h1Count === 0) {
    score -= 5;
    findings.push({
      severity: "medium",
      category: "Content Quality",
      message: "No H1 tag found. Every page should have exactly one H1.",
    });
  } else if (h1Count > 1) {
    findings.push({
      severity: "low",
      category: "Content Quality",
      message: `Multiple H1 tags found (${h1Count}). Use a single H1 per page.`,
    });
  }

  if (h2Count >= 2) {
    score += 10;
  } else {
    findings.push({
      severity: "medium",
      category: "Content Quality",
      message: "Insufficient heading structure. Use H2/H3 subheadings to organize content for AI parseability.",
    });
  }

  // Check for alt text on images
  const imgTags = html.match(/<img[^>]*>/gi) || [];
  const imgsWithAlt = imgTags.filter((img) => /alt\s*=\s*["'][^"']+["']/i.test(img)).length;
  if (imgTags.length > 0) {
    const altRatio = imgsWithAlt / imgTags.length;
    if (altRatio >= 0.9) {
      score += 5;
    } else if (altRatio < 0.5) {
      findings.push({
        severity: "medium",
        category: "Content Quality",
        message: `${imgTags.length - imgsWithAlt} of ${imgTags.length} images missing alt text.`,
      });
    }
  }

  // Check for internal links
  const internalLinks = (html.match(/<a[^>]*href\s*=\s*["']\/[^"']*["']/gi) || []).length;
  if (internalLinks >= 3) {
    score += 5;
  }

  // Check for HTTPS
  if (/<link[^>]*rel\s*=\s*["']canonical["'][^>]*href\s*=\s*["']https:\/\//i.test(html)) {
    score += 5;
  }

  return { score: Math.max(0, Math.min(100, score)), findings };
}

// ── Main Analysis Function ─────────────────────────────────────────────────

export async function analyzeSite(websiteUrl: string): Promise<SiteAnalysisResult> {
  const findings: Finding[] = [];
  const quickWins: string[] = [];

  // Normalize URL
  let url = websiteUrl.trim();
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = "https://" + url;
  }

  // Parse base URL for robots.txt / llms.txt
  let baseUrl: string;
  try {
    const parsed = new URL(url);
    baseUrl = `${parsed.protocol}//${parsed.hostname}`;
  } catch {
    return {
      citabilityScore: 0,
      crawlerScore: 0,
      schemaScore: 0,
      contentQualityScore: 0,
      crawlerDetails: [],
      schemaTypes: [],
      hasLlmsTxt: false,
      hasLlmsFullTxt: false,
      findings: [{ severity: "critical", category: "URL", message: "Invalid URL provided" }],
      quickWins: [],
    };
  }

  const fetchOptions: RequestInit = {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    signal: AbortSignal.timeout(15000),
  };

  // Fetch page, robots.txt, llms.txt, llms-full.txt all in parallel
  const [pageResult, robotsResult, llmsTxtResult, llmsFullTxtResult] = await Promise.allSettled([
    fetch(url, fetchOptions).then((r) => (r.ok ? r.text() : "")),
    fetch(`${baseUrl}/robots.txt`, fetchOptions).then((r) => (r.ok ? r.text() : "")),
    fetch(`${baseUrl}/llms.txt`, fetchOptions).then((r) => ({ exists: r.ok })),
    fetch(`${baseUrl}/llms-full.txt`, fetchOptions).then((r) => ({ exists: r.ok })),
  ]);

  const pageHtml = pageResult.status === "fulfilled" ? pageResult.value : "";
  const robotsTxt = robotsResult.status === "fulfilled" ? robotsResult.value : "";
  const hasLlmsTxt = llmsTxtResult.status === "fulfilled" ? llmsTxtResult.value.exists : false;
  const hasLlmsFullTxt = llmsFullTxtResult.status === "fulfilled" ? llmsFullTxtResult.value.exists : false;

  if (!pageHtml) {
    findings.push({
      severity: "critical",
      category: "Accessibility",
      message: "Could not fetch website. The site may be down or blocking automated requests.",
    });
  }

  // ── Citability Score ───────────────────────────────────────────────────

  let citabilityScore = 0;
  if (pageHtml) {
    const blocks = extractTextBlocks(pageHtml);
    if (blocks.length > 0) {
      const scores = blocks.map((b) => scorePassage(b.content, b.heading));
      citabilityScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    } else {
      findings.push({
        severity: "high",
        category: "Citability",
        message: "No structured content blocks found. AI models need clear, well-organized paragraphs to cite.",
      });
    }
  }

  // ── Crawler Score ──────────────────────────────────────────────────────

  let crawlerScore = 0;
  const crawlerDetails: CrawlerDetail[] = [];

  if (robotsTxt) {
    const agentRules = parseRobotsTxt(robotsTxt);

    for (const crawler of AI_CRAWLERS) {
      const status = getCrawlerStatus(crawler, agentRules);
      crawlerDetails.push({ name: crawler, status });
    }

    const allowedCount = crawlerDetails.filter(
      (c) => c.status === "ALLOWED" || c.status === "NOT_MENTIONED"
    ).length;
    crawlerScore = Math.round((allowedCount / AI_CRAWLERS.length) * 100);

    const blockedCrawlers = crawlerDetails.filter((c) => c.status === "BLOCKED");
    if (blockedCrawlers.length > 0) {
      const names = blockedCrawlers.map((c) => c.name).join(", ");
      findings.push({
        severity: "critical",
        category: "Crawler Access",
        message: `Blocked AI crawlers: ${names}. These AI platforms cannot index your site.`,
      });
      quickWins.push(`Unblock ${blockedCrawlers[0].name} in robots.txt to allow AI indexing`);
    }
  } else {
    // No robots.txt = all crawlers allowed by default
    crawlerScore = 100;
    for (const crawler of AI_CRAWLERS) {
      crawlerDetails.push({ name: crawler, status: "NO_ROBOTS_TXT" });
    }
    findings.push({
      severity: "low",
      category: "Crawler Access",
      message: "No robots.txt found. All crawlers are allowed by default, which is fine for AI visibility.",
    });
  }

  // ── Schema Score ───────────────────────────────────────────────────────

  let schemaScore = 0;
  let schemaTypes: string[] = [];

  if (pageHtml) {
    schemaTypes = detectSchemaMarkup(pageHtml);
    if (schemaTypes.length === 0) {
      schemaScore = 0;
      findings.push({
        severity: "high",
        category: "Schema Markup",
        message: "No schema markup detected. Add JSON-LD structured data (Organization, LocalBusiness, etc.).",
      });
      quickWins.push("Add Organization schema markup (JSON-LD) to help AI understand your business");
    } else {
      // Score based on types present
      const importantTypes = ["Organization", "LocalBusiness", "WebSite", "WebPage", "Article", "FAQPage", "Product", "Service"];
      const hasImportant = schemaTypes.filter((t) => importantTypes.includes(t));
      schemaScore = Math.min(100, 30 + hasImportant.length * 15 + schemaTypes.length * 5);

      if (!schemaTypes.some((t) => t === "Organization" || t === "LocalBusiness")) {
        findings.push({
          severity: "medium",
          category: "Schema Markup",
          message: "Missing Organization or LocalBusiness schema. This is critical for AI entity recognition.",
        });
      }

      if (!schemaTypes.includes("FAQPage")) {
        findings.push({
          severity: "low",
          category: "Schema Markup",
          message: "No FAQPage schema found. FAQ markup increases chances of AI citation.",
        });
      }
    }
  }

  // ── Content Quality Score ──────────────────────────────────────────────

  let contentQualityScore = 50;
  if (pageHtml) {
    const cq = scoreContentQuality(pageHtml);
    contentQualityScore = cq.score;
    findings.push(...cq.findings);
  }

  // ── llms.txt ───────────────────────────────────────────────────────────

  if (!hasLlmsTxt) {
    findings.push({
      severity: "medium",
      category: "AI Optimization",
      message: "No llms.txt file found. This emerging standard helps AI models understand your site structure.",
    });
    quickWins.push("Create an llms.txt file to help AI models navigate your site content");
  }

  // ── Additional Quick Wins ──────────────────────────────────────────────

  if (citabilityScore < 40) {
    quickWins.push("Restructure content into clear, self-contained paragraphs (134-167 words optimal)");
  }

  if (contentQualityScore < 50) {
    quickWins.push("Add more substantive content — aim for 800+ words with clear heading structure");
  }

  return {
    citabilityScore,
    crawlerScore,
    schemaScore,
    contentQualityScore,
    crawlerDetails,
    schemaTypes,
    hasLlmsTxt,
    hasLlmsFullTxt,
    findings: findings.sort((a, b) => {
      const order = { critical: 0, high: 1, medium: 2, low: 3 };
      return order[a.severity] - order[b.severity];
    }),
    quickWins: quickWins.slice(0, 4),
  };
}
