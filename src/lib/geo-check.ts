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

// Extract business names from AI response
function extractCompetitors(
  response: string,
  businessName: string
): string[] {
  const competitors: string[] = [];
  const businessNameLower = businessName.toLowerCase();

  // Common patterns for business names in AI responses
  const patterns = [
    /^\d+\.\s*\*?\*?([^*\n:]+)/gm, // "1. Business Name" or "1. **Business Name**"
    /[-•]\s*\*?\*?([^*\n:]+)/gm, // "- Business Name" or "• Business Name"
    /\*\*([^*]+)\*\*/g, // "**Business Name**"
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(response)) !== null) {
      const name = match[1]?.trim();
      if (
        name &&
        name.length > 2 &&
        name.length < 100 &&
        !name.toLowerCase().includes(businessNameLower) &&
        !competitors.some((c) => c.toLowerCase() === name.toLowerCase())
      ) {
        // Filter out common non-business words
        const skipWords = [
          "here",
          "some",
          "best",
          "top",
          "recommend",
          "following",
          "options",
          "consider",
          "however",
          "note",
          "important",
          "address",
          "phone",
          "website",
          "rating",
          "reviews",
          "services",
          "hours",
        ];
        if (!skipWords.some((w) => name.toLowerCase().startsWith(w))) {
          competitors.push(name);
        }
      }
    }
  }

  // Limit to top 5 competitors
  return competitors.slice(0, 5);
}

// Check if business appears in response
function businessAppears(response: string, businessName: string): boolean {
  const responseLower = response.toLowerCase();
  const businessNameLower = businessName.toLowerCase();

  // Direct match
  if (responseLower.includes(businessNameLower)) {
    return true;
  }

  // Partial match (at least 2 significant words match)
  const businessWords = businessNameLower
    .split(/\s+/)
    .filter((w) => w.length > 3);
  let matchCount = 0;
  for (const word of businessWords) {
    if (responseLower.includes(word)) {
      matchCount++;
    }
  }

  return matchCount >= 2 && businessWords.length >= 2;
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
  service: string,
  city: string
): Promise<GeoCheckResult> {
  // Use the service they provided directly
  const query = `What are the best ${service} providers in ${city}? Give me your top recommendations with specific business names.`;

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

    // ChatGPT check
    openai.chat.completions
      .create({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: query,
          },
        ],
        max_tokens: 1024,
      })
      .then((response) => {
        return response.choices[0]?.message?.content || "";
      })
      .catch((error) => {
        console.error("OpenAI API error:", error);
        return "";
      }),
  ]);

  const inClaude = businessAppears(claudeResult, businessName);
  const inChatGPT = businessAppears(chatGPTResult, businessName);

  // Extract competitors from both responses
  const claudeCompetitors = extractCompetitors(claudeResult, businessName);
  const chatGPTCompetitors = extractCompetitors(chatGPTResult, businessName);

  // Merge and dedupe competitors
  const allCompetitors = [...new Set([...claudeCompetitors, ...chatGPTCompetitors])];

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
