import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { createAuditLead, updateAuditLead } from "@/lib/supabase";
import { runGeoCheck } from "@/lib/geo-check";
import { generateReportEmail } from "@/lib/email-generator";
import { sendEmail } from "@/lib/gmail";

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
    const { businessName, businessType, city, email } = body;

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

    if (!email || !isValidEmail(email)) {
      return NextResponse.json(
        { error: "Valid email is required" },
        { status: 400 }
      );
    }

    // Create initial lead record (with placeholder values)
    const lead = await createAuditLead({
      business_name: businessName.trim(),
      business_type: businessType.trim(),
      city: city?.trim() || null,
      email: email.trim().toLowerCase(),
      report_sent: false,
      in_claude: false,
      in_chatgpt: false,
      competitors: [],
      geo_score: 0,
    });

    // Run GEO check using the business type (calls Claude + OpenAI)
    const geoResult = await runGeoCheck(businessName, businessType, city?.trim() || undefined);

    // Update lead with results
    await updateAuditLead(lead.id, {
      in_claude: geoResult.inClaude,
      in_chatgpt: geoResult.inChatGPT,
      competitors: geoResult.competitors,
      geo_score: geoResult.geoScore,
    });

    // Generate email report
    const emailHtml = await generateReportEmail({
      businessName: businessName.trim(),
      businessType: businessType.trim(),
      city: city?.trim() || null,
      geoScore: geoResult.geoScore,
      inClaude: geoResult.inClaude,
      inChatGPT: geoResult.inChatGPT,
      competitors: geoResult.competitors,
    });

    // Send email
    const emailSent = await sendEmail({
      to: email.trim().toLowerCase(),
      subject: `Your GEO Audit Report: ${businessName}`,
      html: emailHtml,
    });

    // Update report_sent status
    await updateAuditLead(lead.id, {
      report_sent: emailSent,
    });

    console.log(
      `Audit completed for ${businessName} in ${city}. Score: ${geoResult.geoScore}. Email sent: ${emailSent}`
    );

    return NextResponse.json(
      {
        success: true,
        message: emailSent
          ? "Your GEO audit report has been sent to your email!"
          : "Audit completed but email could not be sent. Please try again.",
        leadId: lead.id,
        geoScore: geoResult.geoScore,
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
