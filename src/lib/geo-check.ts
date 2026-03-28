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
}

// Parse AI response into clean list of business names
function parseNames(response: string): string[] {
  return response
    .split('\n')
    .map(line =>
      line
        .replace(/^[\d]+[\.\)]\s*/, '')  // Remove "1." or "1)"
        .replace(/^[\-\*\•]\s*/, '')      // Remove bullets
        .replace(/\*\*/g, '')              // Remove bold markers
        .trim()
    )
    .filter(line => line.length > 1 && line.length < 80)
    .filter(line => !line.toLowerCase().includes('here are'))
    .filter(line => !line.toLowerCase().includes('top 10'))
    .filter(line => !line.toLowerCase().includes('certainly'))
    .filter(line => !line.toLowerCase().includes('based on'))
    .filter(line => !line.toLowerCase().includes('i can'))
    .filter(line => !line.toLowerCase().includes('please note'))
    .filter(line => !line.toLowerCase().includes('keep in mind'))
    .filter(line => !line.toLowerCase().startsWith('note:'))
    .filter(line => !line.toLowerCase().startsWith('disclaimer'));
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
      max_tokens: 1000,
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
    console.log("[GEO Audit] Querying ChatGPT with web search...");

    // Try the responses API with web search first
    try {
      const response = await (openai as any).responses.create({
        model: "gpt-4o",
        tools: [{ type: "web_search_preview" }],
        input: query,
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
      max_tokens: 1000,
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
  // Build queries - ask for clean list of names
  const query = city
    ? `List the top 10 most popular and well-known ${businessType} in ${city}. Just list their names, nothing else. One per line.`
    : `List the top 10 most popular and well-known ${businessType}. Just list their names, nothing else. One per line.`;

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

  // Calculate score
  let score = 0;
  if (foundInChatGPT) score += 50;
  if (foundInClaude) score += 50;

  console.log("Score:", score);
  console.log("=== END DEBUG ===");

  return {
    inClaude: foundInClaude,
    inChatGPT: foundInChatGPT,
    claudeResponse,
    chatGPTResponse,
    competitors,
    geoScore: score,
  };
}

// Export for use in email generation
export { generateAnalysis };
