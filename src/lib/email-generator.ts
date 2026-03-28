import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// Banned words list - humanizer rules to avoid AI-sounding text
const BANNED_WORDS = [
  "delve",
  "tapestry",
  "vibrant",
  "landscape",
  "realm",
  "embark",
  "journey",
  "crucial",
  "pivotal",
  "moreover",
  "furthermore",
  "thus",
  "hence",
  "therefore",
  "utilize",
  "leverage",
  "synergy",
  "paradigm",
  "holistic",
  "robust",
  "cutting-edge",
  "innovative",
  "transformative",
  "groundbreaking",
  "revolutionary",
  "game-changing",
  "seamless",
  "streamline",
  "optimize",
  "enhance",
  "foster",
  "cultivate",
  "nurture",
  "spearhead",
  "harness",
  "unlock",
  "unleash",
  "empower",
  "supercharge",
  "turbocharge",
  "elevate",
  "amplify",
  "bolster",
  "catalyze",
  "cornerstone",
  "underpinned",
  "underscores",
  "multifaceted",
  "ever-evolving",
  "ever-changing",
  "nuanced",
  "intricacies",
  "complexities",
  "at the end of the day",
  "in today's world",
  "in this day and age",
  "it goes without saying",
  "needless to say",
  "rest assured",
  "it is worth noting",
  "it bears mentioning",
  "that being said",
  "having said that",
  "all things considered",
];

interface EmailData {
  businessName: string;
  businessType: string;
  city: string | null;
  geoScore: number;
  inClaude: boolean;
  inChatGPT: boolean;
  competitors: string[];
}

// Remove banned words from text
function humanizeText(text: string): string {
  let result = text;
  for (const word of BANNED_WORDS) {
    const regex = new RegExp(`\\b${word}\\b`, "gi");
    result = result.replace(regex, "");
  }
  // Clean up extra spaces
  result = result.replace(/\s+/g, " ").trim();
  result = result.replace(/\s+([.,!?])/g, "$1");
  return result;
}

export async function generateReportEmail(data: EmailData): Promise<string> {
  const calendlyUrl =
    process.env.NEXT_PUBLIC_CALENDLY_URL || "https://calendly.com/your-link";

  const statusText = getVisibilityStatus(data.inClaude, data.inChatGPT);
  const competitorsList =
    data.competitors.length > 0
      ? data.competitors.map((c) => `• ${c}`).join("\n")
      : "No direct competitors were named.";

  const locationContext = data.city ? ` in ${data.city}` : '';
  const competitorList = data.competitors.length > 0
    ? data.competitors.slice(0, 5).join(", ")
    : "none specifically named";

  const prompt = `Write a 3-sentence analysis for a business owner. Their business "${data.businessName}" (${data.businessType}${locationContext}) was checked for AI visibility.

Results: Found in ChatGPT: ${data.inChatGPT ? "yes" : "no"}. Found in Claude: ${data.inClaude ? "yes" : "no"}.
Competitors that AI recommends instead: ${competitorList}.

Rules: Be direct and specific. Name the competitors. Explain what this means for their business in practical terms. No AI buzzwords (crucial, landscape, leverage, innovative). Use contractions. Short sentences. Sound like a person, not a marketing brochure. No exclamation marks. 3 sentences max.`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 300,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  let analysis =
    response.content[0].type === "text" ? response.content[0].text : "";
  analysis = humanizeText(analysis);

  // Build the HTML email
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Your GEO Audit Report</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">

          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%); padding: 32px 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">Your GEO Audit Report</h1>
              <p style="margin: 8px 0 0; color: #94a3b8; font-size: 14px;">${data.businessName} • ${data.businessType}${data.city ? ` • ${data.city}` : ''}</p>
            </td>
          </tr>

          <!-- Score Section -->
          <tr>
            <td style="padding: 40px;">
              <table role="presentation" style="width: 100%; text-align: center;">
                <tr>
                  <td align="center">
                    <!--[if mso]>
                    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" style="height:136px;v-text-anchor:middle;width:136px;" arcsize="50%" fillcolor="${getScoreColor(data.geoScore)}">
                    <w:anchorlock/>
                    <center style="color:#ffffff;font-family:sans-serif;font-size:48px;font-weight:bold;">${data.geoScore}</center>
                    </v:roundrect>
                    <![endif]-->
                    <!--[if !mso]><!-->
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto;">
                      <tr>
                        <td style="width: 136px; height: 136px; border-radius: 68px; background: ${getScoreGradient(data.geoScore)};" align="center" valign="middle">
                          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              <td style="width: 120px; height: 120px; border-radius: 60px; background-color: #ffffff; text-align: center; vertical-align: middle; line-height: 120px;">
                                <span style="font-size: 48px; font-weight: 700; color: ${getScoreColor(data.geoScore)}; line-height: 120px;">${data.geoScore}</span>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                    <!--<![endif]-->
                    <p style="margin: 16px 0 0; font-size: 18px; font-weight: 600; color: #1e293b;">AI Visibility Score</p>
                    <p style="margin: 4px 0 0; font-size: 14px; color: ${getScoreColor(data.geoScore)}; font-weight: 500;">${statusText}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Platform Results -->
          <tr>
            <td style="padding: 0 40px 32px;">
              <h2 style="margin: 0 0 16px; font-size: 16px; font-weight: 600; color: #1e293b; text-transform: uppercase; letter-spacing: 0.5px;">AI Platform Results</h2>
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 16px; background-color: #f8fafc; border-radius: 8px 8px 0 0; border-bottom: 1px solid #e2e8f0;">
                    <table role="presentation" style="width: 100%;">
                      <tr>
                        <td style="width: 40px;">
                          ${data.inClaude ? getCheckIcon() : getXIcon()}
                        </td>
                        <td>
                          <span style="font-size: 16px; font-weight: 500; color: #1e293b;">Claude</span>
                          <span style="display: block; font-size: 11px; color: #94a3b8;">(AI knowledge)</span>
                          <span style="font-size: 14px; color: ${data.inClaude ? "#22c55e" : "#ef4444"};">${data.inClaude ? "You appear in recommendations" : "Not found in recommendations"}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 16px; background-color: #f8fafc; border-radius: 0 0 8px 8px;">
                    <table role="presentation" style="width: 100%;">
                      <tr>
                        <td style="width: 40px;">
                          ${data.inChatGPT ? getCheckIcon() : getXIcon()}
                        </td>
                        <td>
                          <span style="font-size: 16px; font-weight: 500; color: #1e293b;">ChatGPT</span>
                          <span style="display: block; font-size: 11px; color: #94a3b8;">(live web)</span>
                          <span style="font-size: 14px; color: ${data.inChatGPT ? "#22c55e" : "#ef4444"};">${data.inChatGPT ? "You appear in recommendations" : "Not found in recommendations"}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Competitors Section -->
          ${
            data.competitors.length > 0
              ? `
          <tr>
            <td style="padding: 0 40px 32px;">
              <h2 style="margin: 0 0 16px; font-size: 16px; font-weight: 600; color: #1e293b; text-transform: uppercase; letter-spacing: 0.5px;">Competitors That Appear Instead</h2>
              <div style="padding: 16px; background-color: #fef2f2; border-radius: 8px; border-left: 4px solid #ef4444;">
                <p style="margin: 0; font-size: 14px; color: #1e293b; line-height: 1.6;">
                  ${data.competitors.map((c) => `• ${c}`).join("<br>")}
                </p>
              </div>
            </td>
          </tr>
          `
              : ""
          }

          <!-- Analysis Section -->
          <tr>
            <td style="padding: 0 40px 32px;">
              <h2 style="margin: 0 0 16px; font-size: 16px; font-weight: 600; color: #1e293b; text-transform: uppercase; letter-spacing: 0.5px;">What This Means</h2>
              <div style="padding: 16px; background-color: #f8fafc; border-radius: 8px;">
                <p style="margin: 0; font-size: 15px; color: #475569; line-height: 1.7;">${analysis}</p>
              </div>
            </td>
          </tr>

          <!-- CTA Section -->
          <tr>
            <td style="padding: 0 40px 40px;">
              <div style="padding: 24px; background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); border-radius: 12px; text-align: center;">
                <h3 style="margin: 0 0 8px; font-size: 18px; font-weight: 600; color: #ffffff;">Want to fix this?</h3>
                <p style="margin: 0 0 16px; font-size: 14px; color: rgba(255,255,255,0.9);">Book a free 15-minute strategy call to discuss your options.</p>
                <a href="${calendlyUrl}" style="display: inline-block; padding: 12px 32px; background-color: #ffffff; color: #ea580c; font-size: 16px; font-weight: 600; text-decoration: none; border-radius: 8px;">Book Free Call</a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #94a3b8;">This report was generated by GEO Agency</p>
              <p style="margin: 8px 0 0; font-size: 12px; color: #94a3b8;">Questions? Reply to this email.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

  return html;
}

function getVisibilityStatus(inClaude: boolean, inChatGPT: boolean): string {
  if (inClaude && inChatGPT) {
    return "Visible on both platforms";
  }
  if (inChatGPT) {
    return "Visible in ChatGPT only";
  }
  if (inClaude) {
    return "Visible in Claude only";
  }
  return "Not visible to AI";
}

function getScoreColor(score: number): string {
  if (score >= 100) return "#22c55e"; // Both platforms - green
  if (score >= 50) return "#f97316";  // One platform - orange
  return "#ef4444";                    // Neither - red
}

function getScoreGradient(score: number): string {
  if (score >= 100) return "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)";
  if (score >= 50) return "linear-gradient(135deg, #f97316 0%, #ea580c 100%)";
  return "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)";
}

function getCheckIcon(): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="display: inline-table;">
    <tr>
      <td style="width: 24px; height: 24px; border-radius: 12px; background-color: #dcfce7; text-align: center; vertical-align: middle; line-height: 24px;">
        <span style="color: #22c55e; font-size: 14px; font-weight: bold;">✓</span>
      </td>
    </tr>
  </table>`;
}

function getXIcon(): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="display: inline-table;">
    <tr>
      <td style="width: 24px; height: 24px; border-radius: 12px; background-color: #fee2e2; text-align: center; vertical-align: middle; line-height: 24px;">
        <span style="color: #ef4444; font-size: 14px; font-weight: bold;">✕</span>
      </td>
    </tr>
  </table>`;
}
