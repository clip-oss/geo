"use client";

import { useState, FormEvent } from "react";
import {
  Check,
  X,
  Loader2,
  Mail,
  Building2,
  MapPin,
  Briefcase,
  ArrowRight,
  Sparkles,
  Search,
  CircleAlert,
  Globe,
} from "lucide-react";

type FormState = "idle" | "submitting" | "success" | "error";

export default function Home() {
  const [formState, setFormState] = useState<FormState>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [formData, setFormData] = useState({
    businessName: "",
    businessType: "",
    city: "",
    websiteUrl: "",
    email: "",
  });

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (!formData.businessName.trim()) {
      setErrorMessage("Please enter your business name");
      return;
    }
    if (!formData.businessType.trim()) {
      setErrorMessage("Please enter your business type or industry");
      return;
    }
    // City is optional (for online businesses)
    if (!formData.websiteUrl.trim()) {
      setErrorMessage("Please enter your website URL");
      return;
    }
    if (!validateEmail(formData.email)) {
      setErrorMessage("Please enter a valid email address");
      return;
    }

    setFormState("submitting");

    try {
      const response = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Something went wrong");
      }

      setFormState("success");
      setFormData({ businessName: "", businessType: "", city: "", websiteUrl: "", email: "" });
    } catch (err) {
      setFormState("error");
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to submit. Please try again."
      );
    }
  };

  return (
    <main className="min-h-screen bg-[#0a0a0b]">
      {/* Hero + Form Section */}
      <section className="relative overflow-hidden">
        {/* Gradient orbs */}
        <div className="pointer-events-none absolute -left-40 -top-40 h-80 w-80 rounded-full bg-purple-600/20 blur-[120px]" />
        <div className="pointer-events-none absolute -right-40 top-20 h-96 w-96 rounded-full bg-blue-600/15 blur-[120px]" />

        <div className="relative mx-auto max-w-6xl px-6 py-16 md:py-24">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
            {/* Left: Copy */}
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400">
                <CircleAlert className="h-3.5 w-3.5" />
                <span>73% of businesses are invisible to AI</span>
              </div>

              <h1 className="text-4xl font-bold leading-[1.1] tracking-tight text-white md:text-5xl lg:text-6xl">
                Is AI sending customers to{" "}
                <span className="bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">
                  your competitors?
                </span>
              </h1>

              <p className="mt-6 text-lg leading-relaxed text-zinc-400">
                We analyze your website across the four dimensions that determine
                whether AI systems can find, understand, and recommend your business.
              </p>

              <div className="mt-10 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="mt-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20">
                    <Check className="h-3 w-3 text-emerald-400" />
                  </div>
                  <p className="text-zinc-300">
                    <span className="font-medium text-white">AI Citability</span>{" "}
                    — can AI systems quote and reference your content?
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20">
                    <Check className="h-3 w-3 text-emerald-400" />
                  </div>
                  <p className="text-zinc-300">
                    <span className="font-medium text-white">Crawler Access</span>{" "}
                    — are AI bots allowed to crawl your site?
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20">
                    <Check className="h-3 w-3 text-emerald-400" />
                  </div>
                  <p className="text-zinc-300">
                    <span className="font-medium text-white">Schema &amp; Content Quality</span>{" "}
                    — structured data and E-E-A-T signals for a 0-100 GEO score
                  </p>
                </div>
              </div>

              {/* Stats row */}
              <div className="mt-12 flex gap-8 border-t border-zinc-800 pt-8">
                <div>
                  <p className="text-3xl font-bold text-white">133+</p>
                  <p className="text-sm text-zinc-500">Audits completed</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-white">5 min</p>
                  <p className="text-sm text-zinc-500">To get report</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-white">Free</p>
                  <p className="text-sm text-zinc-500">No strings</p>
                </div>
              </div>
            </div>

            {/* Right: Form */}
            <div id="audit-form">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-8 backdrop-blur-sm">
                {formState === "success" ? (
                  <div className="py-6 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20">
                      <Check className="h-7 w-7 text-emerald-400" />
                    </div>
                    <h3 className="mt-5 text-xl font-semibold text-white">
                      Check your inbox
                    </h3>
                    <p className="mt-2 text-zinc-400">
                      Your GEO Audit report will arrive within 5 minutes.
                    </p>
                    <button
                      onClick={() => setFormState("idle")}
                      className="mt-6 cursor-pointer text-sm font-medium text-blue-400 hover:text-blue-300"
                    >
                      Run another audit
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="mb-6 flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-amber-400" />
                      <h2 className="text-lg font-semibold text-white">
                        Free AI Visibility Audit
                      </h2>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                      {/* Business Name */}
                      <div>
                        <label
                          htmlFor="businessName"
                          className="mb-2 block text-sm font-medium text-zinc-300"
                        >
                          Business Name
                        </label>
                        <div className="relative">
                          <Building2 className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                          <input
                            type="text"
                            id="businessName"
                            name="businessName"
                            value={formData.businessName}
                            onChange={(e) =>
                              setFormData({ ...formData, businessName: e.target.value })
                            }
                            placeholder="e.g. Wolfson & Leon Law Firm"
                            className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 py-3 pl-10 pr-4 text-white placeholder:text-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            disabled={formState === "submitting"}
                          />
                        </div>
                      </div>

                      {/* Business Type / Industry */}
                      <div>
                        <label
                          htmlFor="businessType"
                          className="mb-2 block text-sm font-medium text-zinc-300"
                        >
                          Business Type / Industry
                        </label>
                        <div className="relative">
                          <Briefcase className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                          <input
                            type="text"
                            id="businessType"
                            name="businessType"
                            value={formData.businessType}
                            onChange={(e) =>
                              setFormData({ ...formData, businessType: e.target.value })
                            }
                            placeholder="e.g. Personal injury lawyer, Dental clinic, Med spa"
                            className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 py-3 pl-10 pr-4 text-white placeholder:text-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            disabled={formState === "submitting"}
                          />
                        </div>
                      </div>

                      {/* City (Optional) */}
                      <div>
                        <label
                          htmlFor="city"
                          className="mb-2 block text-sm font-medium text-zinc-300"
                        >
                          City (optional)
                        </label>
                        <div className="relative">
                          <MapPin className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                          <input
                            type="text"
                            id="city"
                            name="city"
                            value={formData.city}
                            onChange={(e) =>
                              setFormData({ ...formData, city: e.target.value })
                            }
                            placeholder="e.g. Miami, FL"
                            className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 py-3 pl-10 pr-4 text-white placeholder:text-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            disabled={formState === "submitting"}
                          />
                        </div>
                      </div>

                      {/* Website URL */}
                      <div>
                        <label
                          htmlFor="websiteUrl"
                          className="mb-2 block text-sm font-medium text-zinc-300"
                        >
                          Website URL
                        </label>
                        <div className="relative">
                          <Globe className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                          <input
                            type="text"
                            id="websiteUrl"
                            name="websiteUrl"
                            value={formData.websiteUrl}
                            onChange={(e) =>
                              setFormData({ ...formData, websiteUrl: e.target.value })
                            }
                            placeholder="e.g. https://yourwebsite.com"
                            className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 py-3 pl-10 pr-4 text-white placeholder:text-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            disabled={formState === "submitting"}
                          />
                        </div>
                        <p className="mt-1 text-xs text-zinc-500">
                          Add your URL for a deep site analysis (crawlers, schema, citability)
                        </p>
                      </div>

                      {/* Email */}
                      <div>
                        <label
                          htmlFor="email"
                          className="mb-2 block text-sm font-medium text-zinc-300"
                        >
                          Email
                        </label>
                        <div className="relative">
                          <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                          <input
                            type="email"
                            id="email"
                            name="email"
                            value={formData.email}
                            onChange={(e) =>
                              setFormData({ ...formData, email: e.target.value })
                            }
                            placeholder="you@company.com"
                            className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 py-3 pl-10 pr-4 text-white placeholder:text-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            disabled={formState === "submitting"}
                          />
                        </div>
                      </div>

                      {/* Error Message */}
                      {errorMessage && (
                        <div className="flex items-center gap-2 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">
                          <X className="h-4 w-4 flex-shrink-0" />
                          <span>{errorMessage}</span>
                        </div>
                      )}

                      {/* Submit Button */}
                      <button
                        type="submit"
                        disabled={formState === "submitting"}
                        className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-blue-500 py-3.5 text-base font-semibold text-white shadow-lg shadow-blue-500/20 hover:from-blue-500 hover:to-blue-400 disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.99]"
                      >
                        {formState === "submitting" ? (
                          <>
                            <Loader2 className="h-5 w-5 animate-spin" />
                            <span>Running audit...</span>
                          </>
                        ) : (
                          <>
                            <Search className="h-5 w-5" />
                            <span>Check My AI Visibility</span>
                          </>
                        )}
                      </button>

                      <p className="text-center text-xs text-zinc-500">
                        Free forever. No spam. Unsubscribe anytime.
                      </p>
                    </form>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-zinc-800/50 bg-zinc-900/30 py-20">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-center text-2xl font-bold text-white md:text-3xl">
            How the audit works
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-zinc-400">
            We analyze your site across the four pillars of AI readiness
          </p>

          <div className="mt-14 grid gap-8 md:grid-cols-3">
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
                <span className="text-xl font-bold">1</span>
              </div>
              <h3 className="mt-4 font-semibold text-white">Deep site scan</h3>
              <p className="mt-2 text-sm text-zinc-400">
                We crawl your site for citability, schema, content quality, and AI crawler access
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400">
                <span className="text-xl font-bold">2</span>
              </div>
              <h3 className="mt-4 font-semibold text-white">Score &amp; analyze</h3>
              <p className="mt-2 text-sm text-zinc-400">
                Four weighted dimensions produce your 0-100 GEO composite score
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
                <span className="text-xl font-bold">3</span>
              </div>
              <h3 className="mt-4 font-semibold text-white">Get your report</h3>
              <p className="mt-2 text-sm text-zinc-400">
                A detailed email report with your scores, findings, and prioritized action plan
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800/50 py-8">
        <div className="mx-auto max-w-5xl px-6">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600">
                <Search className="h-4 w-4 text-white" />
              </div>
              <span className="text-base font-semibold text-white">GEO Agency</span>
            </div>
            <p className="text-sm text-zinc-500">
              &copy; {new Date().getFullYear()} GEO Agency. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
