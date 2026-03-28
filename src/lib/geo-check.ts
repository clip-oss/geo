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

// Extract competitor business names from AI response using Claude
async function extractCompetitorsWithAI(
  aiResponse: string,
  businessType: string,
  city: string | undefined,
  businessName: string
): Promise<string[]> {
  if (!aiResponse.trim()) {
    return [];
  }

  const locationContext = city ? `${businessType} in ${city}` : businessType;

  const prompt = `Here is an AI response about the best ${locationContext}:

---
${aiResponse}
---

Extract ONLY the names of specific businesses, clinics, firms, or companies mentioned as recommendations. Return them as a JSON array of strings. Do NOT include generic advice, tips, suggestions, or non-business-name text. If no specific businesses are mentioned, return an empty array.

Example good output: ["Omni Dent", "Sonic Dent", "Elvimed"]
Example bad output: ["Check Google Reviews", "Ask your hotel"] — never include these

Return ONLY the JSON array, nothing else.`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "[]";

    // Parse JSON array from response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const competitors = JSON.parse(jsonMatch[0]) as string[];
      // Filter out the business being checked
      const businessNameLower = businessName.toLowerCase();
      return competitors.filter(
        (c) => !c.toLowerCase().includes(businessNameLower)
      );
    }
    return [];
  } catch (error) {
    console.error("Error extracting competitors with AI:", error);
    return [];
  }
}

// Check if business appears in response using Claude
async function checkBusinessAppearsWithAI(
  aiResponse: string,
  businessName: string
): Promise<boolean> {
  if (!aiResponse.trim()) {
    return false;
  }

  // Normalize the business name for the prompt
  const normalizedName = businessName.trim();

  const prompt = `Does the following AI response specifically mention or recommend a business called "${normalizedName}"?

IMPORTANT: Match case-insensitively. "${normalizedName.toLowerCase()}" should match "${normalizedName}", "Salvadent Smile" should match "salvadent smile", etc.

Answer YES or NO only.

---
${aiResponse}
---`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 10,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    return text.trim().toUpperCase().startsWith("YES");
  } catch (error) {
    console.error("Error checking business appearance with AI:", error);
    return false;
  }
}

// Calculate GEO score
function calculateGeoScore(inClaude: boolean, inChatGPT: boolean): number {
  if (inClaude && inChatGPT) {
    return 100;
  }
  if (inClaude || inChatGPT) {
    return 50;
  }
  return 0;
}

export async function runGeoCheck(
  businessName: string,
  businessType: string,
  city?: string
): Promise<GeoCheckResult> {
  // Build query based on whether city is provided (for online vs local businesses)
  const query = city
    ? `What are the best ${businessType} in ${city}? Give me your top recommendations with specific business names.`
    : `What are the best ${businessType}? Give me your top recommendations with specific business names.`;

  console.log(`[GEO Audit] Running check for "${businessName}" (${businessType}${city ? `, ${city}` : ''})`);
  console.log(`[GEO Audit] Query: ${query}`);

  // Run both AI checks in parallel
  const [claudeResult, chatGPTResult] = await Promise.all([
    // Claude check
    anthropic.messages
      .create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: query,
          },
        ],
      })
      .then((response) => {
        const text =
          response.content[0].type === "text" ? response.content[0].text : "";
        return text;
      })
      .catch((error) => {
        console.error("Claude API error:", error);
        return "";
      }),

    // ChatGPT check (with web search enabled for real-time local business data)
    (async () => {
      try {
        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "user",
              content: query,
            },
          ],
          max_tokens: 1000,
          web_search_options: {},
        });
        return response.choices[0]?.message?.content || "";
      } catch (error) {
        console.error("OpenAI API error:", error);
        return "";
      }
    })(),
  ]);

  // Log full responses for debugging
  console.log(`[GEO Audit] === CLAUDE RESPONSE ===`);
  console.log(claudeResult);
  console.log(`[GEO Audit] === END CLAUDE RESPONSE ===`);
  console.log(`[GEO Audit] === CHATGPT RESPONSE ===`);
  console.log(chatGPTResult);
  console.log(`[GEO Audit] === END CHATGPT RESPONSE ===`);

  // Use Claude to check visibility and extract competitors (more reliable than regex)
  console.log(`[GEO Audit] Running AI-based visibility checks and competitor extraction...`);

  const [inClaude, inChatGPT, claudeCompetitors, chatGPTCompetitors] = await Promise.all([
    checkBusinessAppearsWithAI(claudeResult, businessName),
    checkBusinessAppearsWithAI(chatGPTResult, businessName),
    extractCompetitorsWithAI(claudeResult, businessType, city, businessName),
    extractCompetitorsWithAI(chatGPTResult, businessType, city, businessName),
  ]);

  console.log(`[GEO Audit] Business "${businessName}" found in Claude: ${inClaude}`);
  console.log(`[GEO Audit] Business "${businessName}" found in ChatGPT: ${inChatGPT}`);
  console.log(`[GEO Audit] Competitors from Claude: ${JSON.stringify(claudeCompetitors)}`);
  console.log(`[GEO Audit] Competitors from ChatGPT: ${JSON.stringify(chatGPTCompetitors)}`);

  // Merge and dedupe competitors, limit to 5
  const allCompetitors = [...new Set([...claudeCompetitors, ...chatGPTCompetitors])].slice(0, 5);

  const geoScore = calculateGeoScore(inClaude, inChatGPT);

  return {
    inClaude,
    inChatGPT,
    claudeResponse: claudeResult,
    chatGPTResponse: chatGPTResult,
    competitors: allCompetitors,
    geoScore,
  };
}
