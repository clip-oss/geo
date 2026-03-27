import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { createAuditLead, updateAuditLead } from "@/lib/supabase";
import { runGeoCheck } from "@/lib/geo-check";
import { generateReportEmail } from "@/lib/email-generator";
import { sendEmail } from "@/lib/gmail";

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
    const { businessName, service, city, email } = body;

    // Validate required fields
    if (!businessName || typeof businessName !== "string") {
      return NextResponse.json(
        { error: "Business name is required" },
        { status: 400 }
      );
    }

    if (!service || typeof service !== "string") {
      return NextResponse.json(
        { error: "Service is required" },
        { status: 400 }
      );
    }

    if (!city || typeof city !== "string") {
      return NextResponse.json({ error: "City is required" }, { status: 400 });
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
      service: service.trim(),
      city: city.trim(),
      email: email.trim().toLowerCase(),
      report_sent: false,
      in_claude: false,
      in_chatgpt: false,
      competitors: [],
      geo_score: 0,
    });

    // Return success immediately - process async in background
    // Using waitUntil pattern for Vercel edge functions
    const backgroundProcess = async () => {
      try {
        // Run GEO check using the service they specified
        const geoResult = await runGeoCheck(businessName, service, city);

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
          service: service.trim(),
          city: city.trim(),
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
      } catch (error) {
        console.error("Background processing error:", error);
      }
    };

    // Start background processing without awaiting
    // In Vercel, this will continue running after the response is sent
    backgroundProcess();

    return NextResponse.json(
      {
        success: true,
        message:
          "Your GEO audit is being processed. Check your inbox within 5 minutes.",
        leadId: lead.id,
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
