import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export interface GeoCheckResult {
  inClaude: boolean;
  inChatGPT: boolean;
  claudeResponse: string;
  chatGPTResponse: string;
  competitors: string[];
  geoScore: number;
  aiVisibilityScore: number;
}

export interface CompositeGeoScore {
  total: number; // 0-100
  aiVisibility: number; // 0-100, weight 25%
  citability: number; // 0-100, weight 25%
  brandAuthority: number; // 0-100, weight 20%
  contentQuality: number; // 0-100, weight 15%
  crawlerAccess: number; // 0-100, weight 10%
  schema: number; // 0-100, weight 5%
}

export function calculateCompositeScore(components: {
  aiVisibility: number;
  citability: number;
  brandAuthority: number;
  contentQuality: number;
  crawlerAccess: number;
  schema: number;
}): CompositeGeoScore {
  const total = Math.round(
    components.aiVisibility * 0.25 +
    components.citability * 0.25 +
    components.brandAuthority * 0.20 +
    components.contentQuality * 0.15 +
    components.crawlerAccess * 0.10 +
    components.schema * 0.05
  );

  return {
    total,
    ...components,
  };
}

// Junk words that indicate advice/instructions, not business names
const JUNK_WORDS = [
  'checking', 'looking', 'consulting', 'asking', 'searching', 'visiting',
  'browsing', 'reading', 'contacting', 'using', 'consider', 'recommend',
  'google', 'directory', 'review', 'website', 'online', 'forum', 'facebook',
  'social media', 'local', 'here are', 'top 10', 'top 15', 'certainly',
  'based on', 'i would', 'you can', 'you might', 'note that', 'keep in mind',
  'disclaimer', 'please note', 'important', 'i can', 'however', 'also',
  'additionally', 'furthermore', 'these are', 'some of', 'popular options'
];

// Parse AI response into clean list of business names
function parseNames(response: string): string[] {
  // First pass: basic cleanup
  const cleaned = response
    .split('\n')
    .map(line =>
      line
        .replace(/^[\d]+[\.\)]\s*/, '')  // Remove "1." or "1)"
        .replace(/^[\-\*\•]\s*/, '')      // Remove bullets
        .replace(/\*\*/g, '')              // Remove bold markers
        .trim()
    );

  // Second pass: strong filtering
  return cleaned.filter(name => {
    const lower = name.toLowerCase();

    // Must be reasonable length for a business name
    if (name.length < 2 || name.length > 60) return false;

    // Must not be a full sentence (too many words)
    if (name.split(' ').length > 7) return false;

    // Must not start with a verb/gerund (action advice, not a business)
    if (lower.match(/^(check|look|consult|ask|search|visit|browse|read|contact|use|consider|try|go to|find|see|explore|reach out|call|email|speak|talk|get|make|do|if you|when you|for the|the best|some of|here are|i would|you can|you might|note:|disclaimer)/)) {
      return false;
    }

    // Must not contain junk words
    if (JUNK_WORDS.some(j => lower.includes(j))) return false;

    return true;
  });
}

// Check if business name appears in the list
function isFound(businessName: string, namesList: string[]): boolean {
  const biz = businessName.toLowerCase().trim();

  for (const name of namesList) {
    const n = name.toLowerCase().trim();

    // Exact match
    if (n === biz) return true;

    // One contains the other
    if (n.includes(biz) || biz.includes(n)) return true;

    // First word match (for short names like "Stake")
    const firstWord = biz.split(' ')[0];
    if (firstWord.length >= 3 && n.includes(firstWord)) return true;
  }

  return false;
}

// Query Claude (no web search - AI knowledge base only)
async function queryClaude(query: string): Promise<string> {
  try {
    console.log("[GEO Audit] Querying Claude...");
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      temperature: 0, // Deterministic output for consistent results
      messages: [{ role: "user", content: query }],
    });
    return response.content[0].type === "text" ? response.content[0].text : "";
  } catch (error) {
    console.error("[GEO Audit] Claude API error:", error);
    return "";
  }
}

// Query ChatGPT with web search
async function queryChatGPT(query: string): Promise<string> {
  try {
    console.log("[GEO Audit] Querying ChatGPT...");

    // Try the responses API with web search first
    try {
      const response = await (openai as any).responses.create({
        model: "gpt-4o",
        tools: [{ type: "web_search_preview" }],
        input: query,
        temperature: 0,
      });
      if (response?.output_text) {
        return response.output_text;
      }
    } catch {
      console.log("[GEO Audit] Responses API not available, falling back to chat completions...");
    }

    // Fallback to chat completions
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: query }],
      max_tokens: 500,
      temperature: 0, // Deterministic output for consistent results
    });
    return response.choices[0]?.message?.content || "";
  } catch (error) {
    console.error("[GEO Audit] ChatGPT API error:", error);
    return "";
  }
}

// Generate personalized analysis with Claude
async function generateAnalysis(
  businessName: string,
  businessType: string,
  city: string | undefined,
  foundInClaude: boolean,
  foundInChatGPT: boolean,
  score: number,
  competitors: string[]
): Promise<string> {
  const prompt = `A business called "${businessName}" (${businessType}${city ? ' in ' + city : ''}) was checked for AI visibility.

Found in ChatGPT: ${foundInChatGPT ? 'Yes' : 'No'}
Found in Claude: ${foundInClaude ? 'Yes' : 'No'}
Score: ${score}/100
Competitors that AI recommends instead: ${competitors.slice(0, 5).join(', ') || 'none found'}

Write exactly 3 sentences explaining what this means for their business. Be direct. Name the competitors. No words like crucial, landscape, leverage, innovative, testament, pivotal. Use contractions. Short sentences. Sound like a person talking, not a brochure.`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    });
    return response.content[0].type === "text" ? response.content[0].text : "";
  } catch (error) {
    console.error("[GEO Audit] Analysis generation error:", error);
    return "Unable to generate analysis.";
  }
}

export async function runGeoCheck(
  businessName: string,
  businessType: string,
  city?: string
): Promise<GeoCheckResult> {
  // Build queries - ask for 15 results with specific instructions for clean output
  const query = city
    ? `Name exactly 15 ${businessType} businesses in ${city}. Only real business names that currently operate there. One name per line. No descriptions, no explanations, no numbering, just the business names.`
    : `Name exactly 15 well-known ${businessType} companies or brands. Only real names. One name per line. No descriptions, no explanations, no numbering, just the names.`;

  console.log("=== AUDIT DEBUG ===");
  console.log("Business:", businessName, "| Type:", businessType, "| City:", city || "(none)");
  console.log("Query:", query);

  // Run both AI queries in parallel
  const [claudeResponse, chatGPTResponse] = await Promise.all([
    queryClaude(query),
    queryChatGPT(query),
  ]);

  console.log("Claude raw response:", claudeResponse);
  console.log("ChatGPT raw response:", chatGPTResponse);

  // Parse responses into name lists
  const claudeNames = parseNames(claudeResponse);
  const chatGPTNames = parseNames(chatGPTResponse);

  console.log("Claude parsed names:", claudeNames);
  console.log("ChatGPT parsed names:", chatGPTNames);

  // Check if business is found
  const foundInClaude = isFound(businessName, claudeNames);
  const foundInChatGPT = isFound(businessName, chatGPTNames);

  console.log("Found in Claude:", foundInClaude);
  console.log("Found in ChatGPT:", foundInChatGPT);

  // Build competitor list (deduplicated, excluding the business itself)
  const allNames = [...new Set([...claudeNames, ...chatGPTNames].map(n => n.trim()))];
  const competitors = allNames
    .filter(name => !isFound(businessName, [name]))
    .slice(0, 8);

  console.log("Competitors:", competitors);

  // Calculate AI visibility score (0-100)
  let aiVisibilityScore = 0;
  if (foundInChatGPT) aiVisibilityScore += 50;
  if (foundInClaude) aiVisibilityScore += 50;

  console.log("AI Visibility Score:", aiVisibilityScore);
  console.log("=== END DEBUG ===");

  return {
    inClaude: foundInClaude,
    inChatGPT: foundInChatGPT,
    claudeResponse,
    chatGPTResponse,
    competitors,
    geoScore: aiVisibilityScore, // Will be replaced by composite in route.ts
    aiVisibilityScore,
  };
}

// Export for use in email generation
export { generateAnalysis };
