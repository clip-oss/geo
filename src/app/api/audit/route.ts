import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { createAuditLead, updateAuditLead } from "@/lib/supabase";
import { runGeoCheck, calculateCompositeScore } from "@/lib/geo-check";
import { generateReportEmail } from "@/lib/email-generator";
import { sendEmail } from "@/lib/gmail";
import { analyzeSite } from "@/lib/site-analyzer";

// Vercel function config - 60 seconds max on free tier
export const maxDuration = 60;

// Validate email format
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Get client IP from request
function getClientIP(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  const realIP = request.headers.get("x-real-ip");
  if (realIP) {
    return realIP;
  }
  return "unknown";
}

export async function POST(request: NextRequest) {
  try {
    // Get client IP for rate limiting
    const clientIP = getClientIP(request);

    // Check rate limit
    const rateLimit = checkRateLimit(clientIP);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: "Too many requests. Please try again later.",
          resetIn: Math.ceil(rateLimit.resetIn / 1000 / 60), // minutes
        },
        {
          status: 429,
          headers: {
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(Math.ceil(rateLimit.resetIn / 1000)),
          },
        }
      );
    }

    // Parse request body
    const body = await request.json();
    const { businessName, businessType, city, websiteUrl, email } = body;

    // Validate required fields
    if (!businessName || typeof businessName !== "string") {
      return NextResponse.json(
        { error: "Business name is required" },
        { status: 400 }
      );
    }

    if (!businessType || typeof businessType !== "string") {
      return NextResponse.json(
        { error: "Business type/industry is required" },
        { status: 400 }
      );
    }

    // City is optional (for online businesses)
    if (city && typeof city !== "string") {
      return NextResponse.json({ error: "City must be a string" }, { status: 400 });
    }

    // Website URL is optional
    if (websiteUrl && typeof websiteUrl !== "string") {
      return NextResponse.json({ error: "Website URL must be a string" }, { status: 400 });
    }

    if (!email || !isValidEmail(email)) {
      return NextResponse.json(
        { error: "Valid email is required" },
        { status: 400 }
      );
    }

    const trimmedWebsiteUrl = websiteUrl?.trim() || null;

    // Create initial lead record (with placeholder values)
    const lead = await createAuditLead({
      business_name: businessName.trim(),
      business_type: businessType.trim(),
      city: city?.trim() || null,
      email: email.trim().toLowerCase(),
      website_url: trimmedWebsiteUrl,
      report_sent: false,
      in_claude: false,
      in_chatgpt: false,
      competitors: [],
      geo_score: 0,
    });

    // Run GEO check AND site analysis in parallel
    const hasWebsite = !!trimmedWebsiteUrl;
    const [geoResult, siteAnalysis] = await Promise.all([
      runGeoCheck(businessName, businessType, city?.trim() || undefined),
      hasWebsite ? analyzeSite(trimmedWebsiteUrl!) : Promise.resolve(null),
    ]);

    // Calculate composite score
    const compositeScore = calculateCompositeScore({
      aiVisibility: geoResult.aiVisibilityScore,
      citability: siteAnalysis?.citabilityScore ?? 0,
      brandAuthority: geoResult.aiVisibilityScore > 0 ? 40 : 15, // Basic brand signal from AI presence
      contentQuality: siteAnalysis?.contentQualityScore ?? 50,
      crawlerAccess: siteAnalysis?.crawlerScore ?? (hasWebsite ? 50 : 80),
      schema: siteAnalysis?.schemaScore ?? 0,
    });

    // Update lead with results
    await updateAuditLead(lead.id, {
      in_claude: geoResult.inClaude,
      in_chatgpt: geoResult.inChatGPT,
      competitors: geoResult.competitors,
      geo_score: geoResult.aiVisibilityScore,
      citability_score: siteAnalysis?.citabilityScore ?? null,
      crawler_score: siteAnalysis?.crawlerScore ?? null,
      schema_score: siteAnalysis?.schemaScore ?? null,
      content_quality_score: siteAnalysis?.contentQualityScore ?? null,
      composite_geo_score: compositeScore.total,
      findings: siteAnalysis?.findings
        ? siteAnalysis.findings.map((f) => ({ ...f }))
        : null,
    });

    // Generate email report (with error handling)
    let emailHtml = "";
    let emailSent = false;

    try {
      emailHtml = await generateReportEmail({
        businessName: businessName.trim(),
        businessType: businessType.trim(),
        city: city?.trim() || null,
        websiteUrl: trimmedWebsiteUrl,
        compositeScore,
        inClaude: geoResult.inClaude,
        inChatGPT: geoResult.inChatGPT,
        competitors: geoResult.competitors,
        siteAnalysis,
      });

      // Send email
      emailSent = await sendEmail({
        to: email.trim().toLowerCase(),
        subject: `Your GEO Audit Report: ${businessName} (Score: ${compositeScore.total}/100)`,
        html: emailHtml,
      });
    } catch (emailError) {
      console.error("[GEO Audit] Email generation/sending error:", emailError);
      // Continue - still return results to user even if email fails
    }

    // Update report_sent status (don't crash if this fails)
    try {
      await updateAuditLead(lead.id, {
        report_sent: emailSent,
      });
    } catch (updateError) {
      console.error("[GEO Audit] Failed to update lead status:", updateError);
    }

    console.log(
      `[GEO Audit] Audit completed for ${businessName}${city ? ` in ${city}` : ""}. Composite: ${compositeScore.total}. Email sent: ${emailSent}`
    );

    return NextResponse.json(
      {
        success: true,
        message: emailSent
          ? "Your GEO audit report has been sent to your email!"
          : "Audit completed but email could not be sent. Please try again.",
        leadId: lead.id,
        geoScore: compositeScore.total,
        inClaude: geoResult.inClaude,
        inChatGPT: geoResult.inChatGPT,
      },
      {
        status: 200,
        headers: {
          "X-RateLimit-Remaining": String(rateLimit.remaining),
        },
      }
    );
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: "An error occurred. Please try again." },
      { status: 500 }
    );
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return NextResponse.json(
    {},
    {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    }
  );
}
