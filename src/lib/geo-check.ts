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

interface AnalysisResult {
  found: boolean;
  competitors: string[];
}

// Analyze AI response for visibility and competitors using Claude
async function analyzeResponseWithAI(
  aiResponse: string,
  businessName: string,
  businessType: string,
  city: string | undefined
): Promise<AnalysisResult> {
  if (!aiResponse.trim()) {
    console.log("[GEO Audit] Empty response, skipping analysis");
    return { found: false, competitors: [] };
  }

  const locationContext = city ? `${businessType} in ${city}` : businessType;
  const queryDescription = city
    ? `What are the best ${businessType} in ${city}?`
    : `What are the best ${businessType}?`;

  const prompt = `I asked an AI: "${queryDescription}"

Here is the AI's full response:
---
${aiResponse}
---

Answer these two questions about the response above:

1. Does the response specifically mention or recommend a business called "${businessName}"? Consider partial matches, alternate spellings, and abbreviations. Answer YES or NO.

2. List ONLY the names of specific businesses, companies, clinics, or firms that are recommended in the response. Return actual business names only. Do NOT include generic advice like "check Google reviews" or "ask locals" or "search online." Do NOT include descriptions, just names.

Return your answer as JSON only, no other text:
{"found": true/false, "competitors": ["Name 1", "Name 2", "Name 3"]}`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "{}";
    console.log("[GEO Audit] Analysis raw response:", text);

    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as AnalysisResult;
      return {
        found: Boolean(parsed.found),
        competitors: Array.isArray(parsed.competitors) ? parsed.competitors : [],
      };
    }
    return { found: false, competitors: [] };
  } catch (error) {
    console.error("[GEO Audit] Error analyzing response:", error);
    return { found: false, competitors: [] };
  }
}

// Calculate GEO score based on visibility
// ChatGPT (with web search) = 50 points
// Claude = 30 points
// Both = 100 points
// Neither = 0 points
function calculateGeoScore(inClaude: boolean, inChatGPT: boolean): number {
  if (inClaude && inChatGPT) {
    return 100;
  }
  if (inChatGPT) {
    return 50;
  }
  if (inClaude) {
    return 30;
  }
  return 0;
}

// Deduplicate competitors case-insensitively and remove the audited business
function dedupeCompetitors(
  competitors: string[],
  businessName: string
): string[] {
  const seen = new Set<string>();
  const businessNameLower = businessName.toLowerCase().trim();
  const result: string[] = [];

  for (const comp of competitors) {
    const compLower = comp.toLowerCase().trim();
    // Skip if it's the business being audited or already seen
    if (compLower.includes(businessNameLower) || businessNameLower.includes(compLower)) {
      continue;
    }
    if (seen.has(compLower)) {
      continue;
    }
    seen.add(compLower);
    result.push(comp.trim());
  }

  return result.slice(0, 8); // Limit to 8 competitors
}

export async function runGeoCheck(
  businessName: string,
  businessType: string,
  city?: string
): Promise<GeoCheckResult> {
  // Build query - NEVER include business name, ask about the industry
  const query = city
    ? `What are the best ${businessType} in ${city}? Give me your top 10 recommendations with names.`
    : `What are the best ${businessType}? Give me your top 10 recommendations with names.`;

  console.log("=".repeat(60));
  console.log("[GEO Audit] STARTING AUDIT");
  console.log("[GEO Audit] Business:", businessName);
  console.log("[GEO Audit] Type:", businessType);
  console.log("[GEO Audit] City:", city || "(none - online business)");
  console.log("QUERY:", query);
  console.log("=".repeat(60));

  // Run both AI queries in parallel with individual error handling
  const [claudeResponse, chatGPTResponse] = await Promise.all([
    // Claude query (no web search - training data only)
    (async () => {
      try {
        console.log("[GEO Audit] Querying Claude...");
        const response = await anthropic.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1500,
          messages: [{ role: "user", content: query }],
        });
        const text = response.content[0].type === "text" ? response.content[0].text : "";
        console.log("CLAUDE RAW RESPONSE:", text.substring(0, 500) + (text.length > 500 ? "..." : ""));
        return text;
      } catch (error) {
        console.error("[GEO Audit] Claude API error:", error);
        return "";
      }
    })(),

    // ChatGPT query (WITH web search for real-time local data)
    (async () => {
      try {
        console.log("[GEO Audit] Querying ChatGPT with web search...");
        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [{ role: "user", content: query }],
          max_tokens: 1500,
          web_search_options: {},
        });
        const text = response.choices[0]?.message?.content || "";
        console.log("CHATGPT RAW RESPONSE:", text.substring(0, 500) + (text.length > 500 ? "..." : ""));
        return text;
      } catch (error) {
        console.error("[GEO Audit] ChatGPT API error:", error);
        return "";
      }
    })(),
  ]);

  // Analyze both responses in parallel (combined visibility + competitor extraction)
  console.log("[GEO Audit] Analyzing responses...");
  const [claudeAnalysis, chatGPTAnalysis] = await Promise.all([
    analyzeResponseWithAI(claudeResponse, businessName, businessType, city),
    analyzeResponseWithAI(chatGPTResponse, businessName, businessType, city),
  ]);

  console.log("CLAUDE ANALYSIS:", JSON.stringify(claudeAnalysis));
  console.log("CHATGPT ANALYSIS:", JSON.stringify(chatGPTAnalysis));

  // Extract results
  const inClaude = claudeAnalysis.found;
  const inChatGPT = chatGPTAnalysis.found;

  // Merge and dedupe competitors from both sources
  const allCompetitors = dedupeCompetitors(
    [...claudeAnalysis.competitors, ...chatGPTAnalysis.competitors],
    businessName
  );

  const geoScore = calculateGeoScore(inClaude, inChatGPT);

  const result = {
    inClaude,
    inChatGPT,
    claudeResponse,
    chatGPTResponse,
    competitors: allCompetitors,
    geoScore,
  };

  console.log("FINAL RESULT:", {
    found: { claude: inClaude, chatgpt: inChatGPT },
    competitors: allCompetitors,
    score: geoScore,
  });
  console.log("=".repeat(60));

  return result;
}
