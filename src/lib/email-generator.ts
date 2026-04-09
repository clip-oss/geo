import Anthropic from "@anthropic-ai/sdk";
import type { SiteAnalysisResult, CrawlerDetail, Finding } from "./site-analyzer";
import type { CompositeGeoScore } from "./geo-check";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// Color palette from geo-seo-claude
const COLORS = {
  PRIMARY: "#1a1a2e",
  ACCENT: "#0f3460",
  HIGHLIGHT: "#e94560",
  SUCCESS: "#00b894",
  WARNING: "#fdcb6e",
  DANGER: "#d63031",
  INFO: "#0984e3",
  WHITE: "#ffffff",
  LIGHT_BG: "#f0f2f5",
  MUTED: "#8395a7",
  DARK_TEXT: "#2d3436",
  BORDER: "#dfe6e9",
};

export interface EmailData {
  businessName: string;
  businessType: string;
  city: string | null;
  websiteUrl: string | null;
  compositeScore: CompositeGeoScore;
  siteAnalysis: SiteAnalysisResult | null;
}

interface ReportContent {
  executiveSummary: string;
  quickWins: string[];
  mediumTerm: string[];
  strategic: string[];
}

function getScoreColor(score: number): string {
  if (score >= 80) return COLORS.SUCCESS;
  if (score >= 60) return COLORS.INFO;
  if (score >= 40) return COLORS.WARNING;
  return COLORS.DANGER;
}

function getScoreLabel(score: number): string {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 55) return "Moderate";
  if (score >= 40) return "Below Average";
  return "Needs Attention";
}

function getSeverityColor(severity: Finding["severity"]): string {
  switch (severity) {
    case "critical": return COLORS.DANGER;
    case "high": return COLORS.HIGHLIGHT;
    case "medium": return COLORS.WARNING;
    case "low": return COLORS.INFO;
  }
}

function getSeverityLabel(severity: Finding["severity"]): string {
  switch (severity) {
    case "critical": return "CRITICAL";
    case "high": return "HIGH";
    case "medium": return "MEDIUM";
    case "low": return "LOW";
  }
}

function getCrawlerStatusLabel(status: CrawlerDetail["status"]): string {
  switch (status) {
    case "ALLOWED": return "Allowed";
    case "BLOCKED": return "Blocked";
    case "PARTIALLY_BLOCKED": return "Partial";
    case "NOT_MENTIONED": return "Allowed";
    case "NO_ROBOTS_TXT": return "Allowed";
  }
}

function getCrawlerStatusColor(status: CrawlerDetail["status"]): string {
  if (status === "BLOCKED") return COLORS.DANGER;
  if (status === "PARTIALLY_BLOCKED") return "#e17055";
  return COLORS.SUCCESS;
}

function getCrawlerPlatform(name: string): string {
  const map: Record<string, string> = {
    "GPTBot": "ChatGPT",
    "ChatGPT-User": "ChatGPT",
    "ClaudeBot": "Claude",
    "anthropic-ai": "Claude",
    "PerplexityBot": "Perplexity",
    "Google-Extended": "Gemini",
    "Bytespider": "TikTok/ByteDance",
    "cohere-ai": "Cohere",
  };
  return map[name] || name;
}

function getCrawlerRecommendation(name: string, status: CrawlerDetail["status"]): string {
  if (status === "BLOCKED") return `Unblock to allow ${getCrawlerPlatform(name)} to cite your content`;
  if (status === "PARTIALLY_BLOCKED") return "Review partial blocks — may limit AI visibility";
  return "Keep allowed";
}

// ── Generate full report content with Claude (like the skill does) ─────────

async function generateReportContent(data: EmailData): Promise<ReportContent> {
  const { compositeScore, siteAnalysis: sa } = data;
  const locationContext = data.city ? ` in ${data.city}` : "";
  const findingsSummary = sa?.findings
    ? sa.findings.map((f) => `[${f.severity.toUpperCase()}] ${f.category}: ${f.message}`).join("\n")
    : "No site analysis performed — no website URL provided.";

  const crawlerSummary = sa?.crawlerDetails
    ? sa.crawlerDetails.map((c) => `${c.name} (${getCrawlerPlatform(c.name)}): ${c.status}`).join(", ")
    : "Not analyzed";

  const prompt = `You are a GEO (Generative Engine Optimization) consultant writing a professional audit report for a client. Analyze the data below and produce a structured report.

CLIENT: "${data.businessName}" (${data.businessType}${locationContext})
WEBSITE: ${data.websiteUrl || "Not provided"}

GEO SCORE: ${compositeScore.total}/100 — ${getScoreLabel(compositeScore.total)}
- Citability Score: ${compositeScore.citability}/100 (weight: 40%)
- Content Quality: ${compositeScore.contentQuality}/100 (weight: 25%)
- Crawler Access: ${compositeScore.crawlerAccess}/100 (weight: 20%)
- Schema / Structured Data: ${compositeScore.schema}/100 (weight: 15%)

CRAWLER ACCESS: ${crawlerSummary}

SCHEMA TYPES FOUND: ${sa?.schemaTypes?.join(", ") || "None detected"}
HAS llms.txt: ${sa?.hasLlmsTxt ? "Yes" : "No"}

KEY FINDINGS:
${findingsSummary}

INSTRUCTIONS:
Reply in EXACTLY this JSON format (no markdown, no code fences, just raw JSON):
{
  "executiveSummary": "A 3-4 sentence executive summary. State the GEO score, what tier it places them in, their strongest and weakest areas, and what the business impact is. Be specific — name the blocked crawlers, missing schema, content issues. Write like a consultant talking to a business owner, not a brochure. Use contractions. Short sentences.",
  "quickWins": ["action 1", "action 2", "action 3", "action 4", "action 5"],
  "mediumTerm": ["action 1", "action 2", "action 3", "action 4", "action 5"],
  "strategic": ["action 1", "action 2", "action 3"]
}

QUICK WINS = things they can do this week, high impact, low effort (e.g., unblock a crawler, add a meta tag, create llms.txt, add author bylines, fix missing schema).
MEDIUM TERM = things for this month, moderate effort (e.g., restructure content for citability, implement Organization schema, adjust content blocks to 134-167 words, add question-based headings).
STRATEGIC = things for this quarter, ongoing investment (e.g., original research program, comprehensive schema implementation, content hub strategy).

Each action item should be specific to THIS business, not generic. Reference their actual scores, their actual missing schema types, their actual blocked crawlers.

CRITICAL: Only recommend actions based on data you actually have above. Do NOT assume the business lacks a Wikipedia page, YouTube channel, Reddit presence, or any other external platform presence — you have no data about these. Never recommend "create a Wikipedia article" or similar. Stick to recommendations about their website, crawler access, schema markup, content structure, and citability — things the audit actually measured.

No banned words: crucial, landscape, leverage, innovative, holistic, robust, cutting-edge, seamless, optimize (use "improve" instead), enhance, foster, cultivate, elevate, amplify, empower, supercharge, unlock, unleash.`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const parsed = JSON.parse(cleaned);

    return {
      executiveSummary: parsed.executiveSummary || "",
      quickWins: parsed.quickWins || [],
      mediumTerm: parsed.mediumTerm || [],
      strategic: parsed.strategic || [],
    };
  } catch (error) {
    console.error("[GEO Audit] Report content generation error:", error);
    return {
      executiveSummary: `${data.businessName} scored ${compositeScore.total}/100 on our GEO audit, placing it in the "${getScoreLabel(compositeScore.total)}" tier. The biggest opportunity is improving ${compositeScore.schema < compositeScore.citability ? "structured data markup" : "content citability"} — this alone could move the score significantly.`,
      quickWins: [
        "Add publication dates to all content pages",
        "Create an llms.txt file to guide AI systems to key content",
        "Add author bylines with credentials to all pages",
        ...(sa?.crawlerDetails?.filter((c) => c.status === "BLOCKED").map((c) => `Unblock ${c.name} in robots.txt`) || []),
      ].slice(0, 5),
      mediumTerm: [
        "Implement Organization + LocalBusiness schema markup (JSON-LD)",
        "Restructure top pages with question-based headings and direct answer blocks",
        "Adjust content blocks for AI citability (134-167 word self-contained passages)",
        "Add sameAs properties linking to all platform profiles",
        "Implement server-side rendering for all public content pages",
      ],
      strategic: [
        "Build Wikipedia/Wikidata entity presence through press coverage",
        "Develop YouTube content strategy aligned with AI-searched queries",
        "Establish original research publication program for unique citability",
      ],
    };
  }
}

// ── HTML building helpers ──────────────────────────────────────────────────

function buildScoreTable(compositeScore: CompositeGeoScore): string {
  const rows = [
    { label: "Citability", score: compositeScore.citability, weight: "40%" },
    { label: "Content Quality & E-E-A-T", score: compositeScore.contentQuality, weight: "25%" },
    { label: "Crawler Access", score: compositeScore.crawlerAccess, weight: "20%" },
    { label: "Structured Data", score: compositeScore.schema, weight: "15%" },
  ];

  const dataRows = rows.map((r) => {
    const color = getScoreColor(r.score);
    const weighted = Math.round(r.score * parseFloat(r.weight) / 100);
    return `<tr>
      <td style="padding:8px 12px;font-size:13px;color:${COLORS.DARK_TEXT};border-bottom:1px solid ${COLORS.BORDER}">${r.label}</td>
      <td style="padding:8px 12px;font-size:13px;font-weight:700;color:${color};border-bottom:1px solid ${COLORS.BORDER};text-align:center">${r.score}/100</td>
      <td style="padding:8px 12px;font-size:13px;color:${COLORS.MUTED};border-bottom:1px solid ${COLORS.BORDER};text-align:center">${r.weight}</td>
      <td style="padding:8px 12px;font-size:13px;color:${COLORS.DARK_TEXT};border-bottom:1px solid ${COLORS.BORDER};text-align:center">${weighted}</td>
    </tr>`;
  }).join("");

  const totalColor = getScoreColor(compositeScore.total);
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;border:1px solid ${COLORS.BORDER};border-radius:8px">
    <tr style="background-color:${COLORS.PRIMARY}">
      <td style="padding:8px 12px;font-size:11px;font-weight:700;color:${COLORS.WHITE};text-transform:uppercase">Component</td>
      <td style="padding:8px 12px;font-size:11px;font-weight:700;color:${COLORS.WHITE};text-transform:uppercase;text-align:center">Score</td>
      <td style="padding:8px 12px;font-size:11px;font-weight:700;color:${COLORS.WHITE};text-transform:uppercase;text-align:center">Weight</td>
      <td style="padding:8px 12px;font-size:11px;font-weight:700;color:${COLORS.WHITE};text-transform:uppercase;text-align:center">Weighted</td>
    </tr>
    ${dataRows}
    <tr style="background-color:#eef2f7">
      <td style="padding:10px 12px;font-size:13px;font-weight:700;color:${COLORS.DARK_TEXT}">OVERALL</td>
      <td style="padding:10px 12px;font-size:14px;font-weight:800;color:${totalColor};text-align:center">${compositeScore.total}/100</td>
      <td style="padding:10px 12px;font-size:13px;font-weight:700;color:${COLORS.DARK_TEXT};text-align:center">100%</td>
      <td style="padding:10px 12px;font-size:14px;font-weight:800;color:${totalColor};text-align:center">${compositeScore.total}</td>
    </tr>
  </table>`;
}

function buildProgressBar(label: string, score: number): string {
  const color = getScoreColor(score);
  return `<tr><td style="padding:6px 0">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%"><tr>
      <td style="font-size:12px;color:${COLORS.DARK_TEXT};font-weight:500;padding-bottom:3px">${label}</td>
      <td style="font-size:12px;color:${color};font-weight:700;text-align:right;padding-bottom:3px">${score}/100</td>
    </tr></table>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%"><tr>
      <td style="background-color:#e8ecf0;border-radius:4px;height:8px">
        <div style="background-color:${color};border-radius:4px;height:8px;width:${Math.max(3, Math.round((score / 100) * 100))}%"></div>
      </td>
    </tr></table>
  </td></tr>`;
}

function buildCrawlerTable(crawlerDetails: CrawlerDetail[]): string {
  const rows = crawlerDetails.map((c) => {
    const statusColor = getCrawlerStatusColor(c.status);
    const statusBg = c.status === "BLOCKED" ? "#fde8e8" : c.status === "PARTIALLY_BLOCKED" ? "#fef9e7" : "#e6f9f0";
    return `<tr>
      <td style="padding:7px 10px;font-size:12px;color:${COLORS.DARK_TEXT};border-bottom:1px solid ${COLORS.BORDER}">${c.name}</td>
      <td style="padding:7px 10px;font-size:12px;color:${COLORS.MUTED};border-bottom:1px solid ${COLORS.BORDER}">${getCrawlerPlatform(c.name)}</td>
      <td style="padding:7px 4px;border-bottom:1px solid ${COLORS.BORDER};text-align:center">
        <span style="display:inline-block;padding:2px 10px;background-color:${statusBg};color:${statusColor};border-radius:3px;font-size:11px;font-weight:700">${getCrawlerStatusLabel(c.status)}</span>
      </td>
      <td style="padding:7px 10px;font-size:11px;color:${COLORS.MUTED};border-bottom:1px solid ${COLORS.BORDER}">${getCrawlerRecommendation(c.name, c.status)}</td>
    </tr>`;
  }).join("");

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;border:1px solid ${COLORS.BORDER};border-radius:8px">
    <tr style="background-color:${COLORS.PRIMARY}">
      <td style="padding:7px 10px;font-size:10px;font-weight:700;color:${COLORS.WHITE};text-transform:uppercase">Crawler</td>
      <td style="padding:7px 10px;font-size:10px;font-weight:700;color:${COLORS.WHITE};text-transform:uppercase">Platform</td>
      <td style="padding:7px 10px;font-size:10px;font-weight:700;color:${COLORS.WHITE};text-transform:uppercase;text-align:center">Status</td>
      <td style="padding:7px 10px;font-size:10px;font-weight:700;color:${COLORS.WHITE};text-transform:uppercase">Recommendation</td>
    </tr>
    ${rows}
  </table>`;
}

function buildActionList(items: string[], accentColor: string): string {
  if (items.length === 0) return "";
  const rows = items.map((item, i) => `<tr>
    <td style="padding:8px 12px;border-bottom:1px solid ${COLORS.BORDER}">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="width:24px;height:24px;border-radius:12px;background-color:${accentColor};text-align:center;vertical-align:middle;line-height:24px">
          <span style="color:${COLORS.WHITE};font-size:12px;font-weight:700">${i + 1}</span>
        </td>
        <td style="padding-left:10px;font-size:13px;color:${COLORS.DARK_TEXT};line-height:1.5">${item}</td>
      </tr></table>
    </td>
  </tr>`).join("");

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;background-color:${COLORS.WHITE};border-radius:8px;border:1px solid ${COLORS.BORDER}">${rows}</table>`;
}

function buildPlatformRow(name: string, subtitle: string, found: boolean): string {
  const statusColor = found ? COLORS.SUCCESS : COLORS.DANGER;
  const statusBg = found ? "#e6f9f0" : "#fde8e8";
  const statusIcon = found ? "&#10003;" : "&#10005;";
  const statusText = found ? "Found in recommendations" : "Not found";

  return `<tr><td style="padding:12px 14px;border-bottom:1px solid ${COLORS.BORDER}">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%"><tr>
      <td style="width:28px;height:28px;border-radius:14px;background-color:${statusBg};text-align:center;vertical-align:middle;line-height:28px">
        <span style="color:${statusColor};font-size:14px;font-weight:bold">${statusIcon}</span>
      </td>
      <td style="padding-left:10px">
        <span style="font-size:14px;font-weight:600;color:${COLORS.DARK_TEXT}">${name}</span>
        <span style="display:block;font-size:11px;color:${COLORS.MUTED}">${subtitle}</span>
      </td>
      <td style="text-align:right">
        <span style="font-size:12px;color:${statusColor};font-weight:600">${statusText}</span>
      </td>
    </tr></table>
  </td></tr>`;
}

function sectionHeader(title: string): string {
  return `<tr><td style="padding:24px 32px 12px">
    <h2 style="margin:0;font-size:16px;font-weight:700;color:${COLORS.PRIMARY}">${title}</h2>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin-top:6px"><tr>
      <td style="border-bottom:2px solid ${COLORS.ACCENT};height:1px;font-size:1px">&nbsp;</td>
    </tr></table>
  </td></tr>`;
}

function sectionSubheader(title: string, subtitle: string): string {
  return `<tr><td style="padding:16px 32px 6px">
    <h3 style="margin:0;font-size:14px;font-weight:700;color:${COLORS.ACCENT}">${title}</h3>
    <p style="margin:2px 0 0;font-size:11px;color:${COLORS.MUTED}">${subtitle}</p>
  </td></tr>`;
}

// ── MAIN ──────────────────────────────────────────────────────────────────

export async function generateReportEmail(data: EmailData): Promise<string> {
  const calendlyUrl = process.env.NEXT_PUBLIC_CALENDLY_URL || "https://calendly.com/your-link";
  const { compositeScore } = data;
  const score = compositeScore.total;
  const scoreColor = getScoreColor(score);
  const scoreLabel = getScoreLabel(score);
  const sa = data.siteAnalysis;
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  // Generate full report content with Claude (like the skill does)
  const report = await generateReportContent(data);

  const scoreTable = buildScoreTable(compositeScore);
  const progressBars = [
    buildProgressBar("Citability", compositeScore.citability),
    buildProgressBar("Content Quality", compositeScore.contentQuality),
    buildProgressBar("Crawler Access", compositeScore.crawlerAccess),
    buildProgressBar("Schema", compositeScore.schema),
  ].join("");

  // Crawler section
  let crawlerSection = "";
  if (sa && sa.crawlerDetails.length > 0) {
    crawlerSection = `
      ${sectionHeader("AI Crawler Access Status")}
      <tr><td style="padding:0 32px 8px"><p style="margin:0;font-size:13px;color:${COLORS.MUTED};line-height:1.5">Blocking AI crawlers prevents AI platforms from citing your content.</p></td></tr>
      <tr><td style="padding:0 32px 24px">${buildCrawlerTable(sa.crawlerDetails)}</td></tr>`;
  }

  // Key findings
  let findingsSection = "";
  const findings = sa?.findings ?? [];
  if (findings.length > 0) {
    const findingRows = findings.slice(0, 8).map((f) => {
      const sevColor = getSeverityColor(f.severity);
      const sevLabel = getSeverityLabel(f.severity);
      return `<tr><td style="padding:8px 12px;border-bottom:1px solid ${COLORS.BORDER}">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%">
          <tr><td>
            <span style="display:inline-block;padding:2px 8px;background-color:${sevColor};color:${COLORS.WHITE};border-radius:3px;font-size:10px;font-weight:700;letter-spacing:0.5px">${sevLabel}</span>
            <span style="display:inline-block;padding:2px 8px;background-color:#eef2f7;color:${COLORS.MUTED};border-radius:3px;font-size:10px;font-weight:600;margin-left:4px">${f.category}</span>
          </td></tr>
          <tr><td style="padding-top:5px;font-size:12px;color:${COLORS.DARK_TEXT};line-height:1.5">${f.message}</td></tr>
        </table>
      </td></tr>`;
    }).join("");
    findingsSection = `
      ${sectionHeader("Key Findings")}
      <tr><td style="padding:0 32px 24px">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;border:1px solid ${COLORS.BORDER};border-radius:8px">${findingRows}</table>
      </td></tr>`;
  }

  // Schema info
  let schemaSection = "";
  if (sa) {
    const schemaStatus = sa.schemaTypes.length > 0 ? `Found: ${sa.schemaTypes.join(", ")}` : "No schema markup detected";
    const llmsStatus = sa.hasLlmsTxt ? "Found" : "Not found";
    schemaSection = `<tr><td style="padding:0 32px 24px">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;border:1px solid ${COLORS.BORDER};border-radius:8px">
        <tr>
          <td style="padding:10px 14px;font-size:12px;font-weight:600;color:${COLORS.DARK_TEXT};border-bottom:1px solid ${COLORS.BORDER}">Schema Markup (JSON-LD)</td>
          <td style="padding:10px 14px;font-size:12px;color:${sa.schemaTypes.length > 0 ? COLORS.SUCCESS : COLORS.DANGER};border-bottom:1px solid ${COLORS.BORDER}">${schemaStatus}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;font-size:12px;font-weight:600;color:${COLORS.DARK_TEXT}">llms.txt</td>
          <td style="padding:10px 14px;font-size:12px;color:${sa.hasLlmsTxt ? COLORS.SUCCESS : COLORS.DANGER}">${llmsStatus}</td>
        </tr>
      </table>
    </td></tr>`;
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>GEO Analysis Report — ${data.businessName}</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:${COLORS.LIGHT_BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;background-color:${COLORS.LIGHT_BG}">
    <tr><td style="padding:24px 16px">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;margin:0 auto;background-color:${COLORS.WHITE};border-radius:12px;overflow:hidden;border:1px solid ${COLORS.BORDER}">

        <!-- HEADER -->
        <tr><td style="background-color:${COLORS.PRIMARY};padding:28px 32px 24px">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%">
            <tr><td>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
                <td style="width:32px;height:32px;border-radius:6px;background-color:${COLORS.ACCENT};text-align:center;vertical-align:middle;line-height:32px">
                  <span style="color:${COLORS.WHITE};font-size:16px;font-weight:700">G</span>
                </td>
                <td style="padding-left:8px"><span style="font-size:16px;font-weight:700;color:${COLORS.WHITE}">GEO Agency</span></td>
              </tr></table>
            </td></tr>
            <tr><td style="padding-top:18px">
              <h1 style="margin:0;font-size:22px;font-weight:700;color:${COLORS.WHITE};line-height:1.3">GEO Analysis Report</h1>
              <p style="margin:4px 0 0;font-size:13px;color:${COLORS.MUTED}">Generative Engine Optimization Audit for <strong style="color:${COLORS.WHITE}">${data.businessName}</strong></p>
            </td></tr>
          </table>
        </td></tr>

        <!-- KEY DETAILS -->
        <tr><td style="padding:20px 32px 0">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%">
            <tr><td style="font-size:12px;font-weight:700;color:${COLORS.ACCENT};padding:6px 0;border-bottom:1px solid ${COLORS.BORDER}">Website</td><td style="font-size:12px;color:${COLORS.DARK_TEXT};padding:6px 0;border-bottom:1px solid ${COLORS.BORDER}">${data.websiteUrl || "Not provided"}</td></tr>
            <tr><td style="font-size:12px;font-weight:700;color:${COLORS.ACCENT};padding:6px 0;border-bottom:1px solid ${COLORS.BORDER}">Industry</td><td style="font-size:12px;color:${COLORS.DARK_TEXT};padding:6px 0;border-bottom:1px solid ${COLORS.BORDER}">${data.businessType}${data.city ? ` &bull; ${data.city}` : ""}</td></tr>
            <tr><td style="font-size:12px;font-weight:700;color:${COLORS.ACCENT};padding:6px 0;border-bottom:1px solid ${COLORS.BORDER}">Analysis Date</td><td style="font-size:12px;color:${COLORS.DARK_TEXT};padding:6px 0;border-bottom:1px solid ${COLORS.BORDER}">${today}</td></tr>
            <tr><td style="font-size:12px;font-weight:700;color:${COLORS.ACCENT};padding:6px 0">GEO Score</td><td style="font-size:12px;font-weight:700;color:${scoreColor};padding:6px 0">${score}/100 — ${scoreLabel}</td></tr>
          </table>
        </td></tr>

        <!-- SCORE GAUGE -->
        <tr><td style="padding:24px 32px 8px;text-align:center">
          <!--[if mso]>
          <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" style="height:130px;v-text-anchor:middle;width:130px;" arcsize="50%" fillcolor="${scoreColor}" stroke="false"><w:anchorlock/><center style="color:#ffffff;font-family:sans-serif;font-size:44px;font-weight:bold">${score}</center></v:roundrect>
          <![endif]-->
          <!--[if !mso]><!-->
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto"><tr>
            <td style="width:130px;height:130px;border-radius:65px;background-color:${scoreColor}" align="center" valign="middle">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
                <td style="width:110px;height:110px;border-radius:55px;background-color:${COLORS.WHITE};text-align:center;vertical-align:middle">
                  <span style="font-size:44px;font-weight:800;color:${scoreColor};line-height:1">${score}</span>
                  <span style="display:block;font-size:11px;font-weight:600;color:${COLORS.MUTED};margin-top:-2px">/ 100</span>
                </td>
              </tr></table>
            </td>
          </tr></table>
          <!--<![endif]-->
          <p style="margin:10px 0 0;font-size:13px;font-weight:600;color:${scoreColor}">${scoreLabel}</p>
        </td></tr>

        <!-- EXECUTIVE SUMMARY -->
        ${sectionHeader("Executive Summary")}
        <tr><td style="padding:0 32px 24px">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%"><tr>
            <td style="padding:14px;background-color:#f8f9fb;border-radius:8px;border:1px solid ${COLORS.BORDER}">
              <p style="margin:0;font-size:13px;color:${COLORS.DARK_TEXT};line-height:1.7">${report.executiveSummary}</p>
            </td>
          </tr></table>
        </td></tr>

        <!-- SCORE BREAKDOWN TABLE -->
        ${sectionHeader("GEO Score Breakdown")}
        <tr><td style="padding:0 32px 16px">${scoreTable}</td></tr>
        <tr><td style="padding:0 32px 24px">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%">${progressBars}</table>
        </td></tr>

        <!-- AI CRAWLER ACCESS -->
        ${crawlerSection}

        <!-- STRUCTURED DATA -->
        ${sa ? sectionHeader("Structured Data & AI Signals") + schemaSection : ""}

        <!-- KEY FINDINGS -->
        ${findingsSection}

        <!-- PRIORITIZED ACTION PLAN -->
        ${sectionHeader("Prioritized Action Plan")}
        ${sectionSubheader("Quick Wins (This Week)", "High impact, low effort — implement immediately")}
        <tr><td style="padding:0 32px 16px">${buildActionList(report.quickWins, COLORS.SUCCESS)}</td></tr>
        ${sectionSubheader("Medium-Term Improvements (This Month)", "Significant impact, moderate effort — content and technical changes")}
        <tr><td style="padding:0 32px 16px">${buildActionList(report.mediumTerm, COLORS.INFO)}</td></tr>
        ${sectionSubheader("Strategic Initiatives (This Quarter)", "Long-term competitive advantage — ongoing investment")}
        <tr><td style="padding:0 32px 24px">${buildActionList(report.strategic, COLORS.ACCENT)}</td></tr>

        <!-- METHODOLOGY -->
        ${sectionHeader("Methodology")}
        <tr><td style="padding:0 32px 24px">
          <p style="margin:0;font-size:12px;color:${COLORS.MUTED};line-height:1.6">This GEO audit was conducted on ${today} analyzing ${data.websiteUrl || data.businessName}. The analysis evaluated the website across four dimensions: Citability (40%), Content Quality &amp; E-E-A-T (25%), Crawler Access (20%), and Structured Data (15%).</p>
          <p style="margin:8px 0 0;font-size:12px;color:${COLORS.MUTED};line-height:1.6"><strong>Analysis includes:</strong> AI crawler access mapping, schema markup detection, citability scoring, content quality assessment, and llms.txt compliance.</p>
          <p style="margin:8px 0 0;font-size:12px;color:${COLORS.MUTED};line-height:1.6"><strong>Standards referenced:</strong> Google Search Quality Rater Guidelines, Schema.org specification, llms.txt emerging standard, Ahrefs brand mention correlation research (Dec 2025)</p>
        </td></tr>

        <!-- CTA -->
        <tr><td style="padding:0 32px 28px">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;background-color:${COLORS.ACCENT};border-radius:10px"><tr>
            <td style="padding:24px 20px;text-align:center">
              <h3 style="margin:0 0 6px;font-size:18px;font-weight:700;color:${COLORS.WHITE}">Ready to improve your GEO score?</h3>
              <p style="margin:0 0 16px;font-size:13px;color:rgba(255,255,255,0.8);line-height:1.5">Book a free 15-minute strategy call. We'll walk through your report and show you the fastest path to AI visibility.</p>
              <!--[if mso]>
              <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${calendlyUrl}" style="height:42px;v-text-anchor:middle;width:180px;" arcsize="18%" fillcolor="${COLORS.HIGHLIGHT}" stroke="false"><w:anchorlock/><center style="color:#ffffff;font-family:sans-serif;font-size:15px;font-weight:bold">Book Free Call</center></v:roundrect>
              <![endif]-->
              <!--[if !mso]><!-->
              <a href="${calendlyUrl}" style="display:inline-block;padding:11px 28px;background-color:${COLORS.HIGHLIGHT};color:${COLORS.WHITE};font-size:15px;font-weight:700;text-decoration:none;border-radius:6px">Book Free Call</a>
              <!--<![endif]-->
            </td>
          </tr></table>
        </td></tr>

        <!-- FOOTER -->
        <tr><td style="padding:16px 32px;background-color:#f8f9fb;border-top:1px solid ${COLORS.BORDER}">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%"><tr>
            <td style="text-align:center">
              <p style="margin:0;font-size:11px;color:${COLORS.MUTED}">Generated by GEO Agency &bull; ${today} &bull; Confidential</p>
              <p style="margin:4px 0 0;font-size:11px;color:${COLORS.MUTED}">Questions? Reply to this email.</p>
            </td>
          </tr></table>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
