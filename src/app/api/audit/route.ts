import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { createAuditLead, updateAuditLead } from "@/lib/supabase";
import { calculateCompositeScore } from "@/lib/geo-check";
import { generateReportEmail } from "@/lib/email-generator";
import { sendEmail } from "@/lib/gmail";
import { analyzeSite } from "@/lib/site-analyzer";

// Vercel function config - 60 seconds max on free tier
export const maxDuration = 60;

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// AI platform blocklist
const AI_PLATFORM_PATTERNS = [
  "chatgpt", "chat gpt", "openai", "open ai",
  "claude", "anthropic",
  "gemini", "google ai", "google bard", "bard",
  "perplexity",
  "copilot", "bing chat", "bing ai",
  "microsoft ai", "meta ai",
  "grok", "xai", "x ai",
  "deepseek", "deep seek",
  "mistral",
  "cohere",
];

function isAIPlatform(name: string): boolean {
  const lower = name.toLowerCase().trim();
  return AI_PLATFORM_PATTERNS.some((pattern) => lower.includes(pattern));
}

function getClientIP(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "unknown";
}

export async function POST(request: NextRequest) {
  try {
    const clientIP = getClientIP(request);
    const rateLimit = checkRateLimit(clientIP);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later.", resetIn: Math.ceil(rateLimit.resetIn / 1000 / 60) },
        { status: 429, headers: { "X-RateLimit-Remaining": "0", "X-RateLimit-Reset": String(Math.ceil(rateLimit.resetIn / 1000)) } }
      );
    }

    const body = await request.json();
    const { businessName, businessType, city, websiteUrl, email } = body;

    if (!businessName || typeof businessName !== "string") {
      return NextResponse.json({ error: "Business name is required" }, { status: 400 });
    }
    if (!businessType || typeof businessType !== "string") {
      return NextResponse.json({ error: "Business type/industry is required" }, { status: 400 });
    }
    if (!websiteUrl || typeof websiteUrl !== "string" || !websiteUrl.trim()) {
      return NextResponse.json({ error: "Website URL is required for the audit" }, { status: 400 });
    }
    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
    }
    if (isAIPlatform(businessName)) {
      return NextResponse.json(
        { error: "We can't audit AI platforms against themselves. Please enter a business or brand name." },
        { status: 400 }
      );
    }

    const trimmedUrl = websiteUrl.trim();

    // Create lead record
    const lead = await createAuditLead({
      business_name: businessName.trim(),
      business_type: businessType.trim(),
      city: city?.trim() || null,
      email: email.trim().toLowerCase(),
      website_url: trimmedUrl,
      report_sent: false,
      in_claude: false,
      in_chatgpt: false,
      competitors: [],
      geo_score: 0,
    });

    // Run the GEO skill analysis
    const siteAnalysis = await analyzeSite(trimmedUrl);

    // Calculate composite score from skill results
    const compositeScore = calculateCompositeScore({
      citability: siteAnalysis.citabilityScore,
      contentQuality: siteAnalysis.contentQualityScore,
      crawlerAccess: siteAnalysis.crawlerScore,
      schema: siteAnalysis.schemaScore,
    });

    // Update lead with results
    await updateAuditLead(lead.id, {
      geo_score: compositeScore.total,
      citability_score: siteAnalysis.citabilityScore,
      crawler_score: siteAnalysis.crawlerScore,
      schema_score: siteAnalysis.schemaScore,
      content_quality_score: siteAnalysis.contentQualityScore,
      composite_geo_score: compositeScore.total,
      findings: siteAnalysis.findings.map((f) => ({ ...f })),
    });

    // Generate and send email report
    let emailSent = false;
    try {
      const emailHtml = await generateReportEmail({
        businessName: businessName.trim(),
        businessType: businessType.trim(),
        city: city?.trim() || null,
        websiteUrl: trimmedUrl,
        compositeScore,
        siteAnalysis,
      });

      emailSent = await sendEmail({
        to: email.trim().toLowerCase(),
        subject: `Your GEO Audit Report: ${businessName} (Score: ${compositeScore.total}/100)`,
        html: emailHtml,
      });
    } catch (emailError) {
      console.error("[GEO Audit] Email error:", emailError);
    }

    try {
      await updateAuditLead(lead.id, { report_sent: emailSent });
    } catch (e) {
      console.error("[GEO Audit] Failed to update lead status:", e);
    }

    console.log(`[GEO Audit] Done: ${businessName} | Score: ${compositeScore.total} | Email: ${emailSent}`);

    return NextResponse.json(
      {
        success: true,
        message: emailSent
          ? "Your GEO audit report has been sent to your email!"
          : "Audit completed but email could not be sent. Please try again.",
        leadId: lead.id,
        geoScore: compositeScore.total,
      },
      { status: 200, headers: { "X-RateLimit-Remaining": String(rateLimit.remaining) } }
    );
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json({ error: "An error occurred. Please try again." }, { status: 500 });
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, {
    status: 200,
    headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" },
  });
}
