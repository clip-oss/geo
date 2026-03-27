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
} from "lucide-react";

type FormState = "idle" | "submitting" | "success" | "error";

export default function Home() {
  const [formState, setFormState] = useState<FormState>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [formData, setFormData] = useState({
    businessName: "",
    service: "",
    city: "",
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
    if (!formData.service.trim()) {
      setErrorMessage("Please enter what service you offer");
      return;
    }
    if (!formData.city.trim()) {
      setErrorMessage("Please enter your city");
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
      setFormData({ businessName: "", service: "", city: "", email: "" });
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
                When someone asks ChatGPT or Claude for a recommendation in your
                industry, does your business come up? Or are they sending leads
                straight to your competition?
              </p>

              <div className="mt-10 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="mt-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20">
                    <Check className="h-3 w-3 text-emerald-400" />
                  </div>
                  <p className="text-zinc-300">
                    <span className="font-medium text-white">We ask the AI directly</span>{" "}
                    — "Who's the best {"{your service}"} in {"{your city}"}?"
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20">
                    <Check className="h-3 w-3 text-emerald-400" />
                  </div>
                  <p className="text-zinc-300">
                    <span className="font-medium text-white">You see if you appear</span>{" "}
                    — and which competitors do
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20">
                    <Check className="h-3 w-3 text-emerald-400" />
                  </div>
                  <p className="text-zinc-300">
                    <span className="font-medium text-white">Get your GEO score</span>{" "}
                    — 0-100 visibility rating across AI platforms
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
                            placeholder="Smith & Associates Law"
                            className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 py-3 pl-10 pr-4 text-white placeholder:text-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            disabled={formState === "submitting"}
                          />
                        </div>
                      </div>

                      {/* Service */}
                      <div>
                        <label
                          htmlFor="service"
                          className="mb-2 block text-sm font-medium text-zinc-300"
                        >
                          What service do you offer?
                        </label>
                        <div className="relative">
                          <Briefcase className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                          <input
                            type="text"
                            id="service"
                            name="service"
                            value={formData.service}
                            onChange={(e) =>
                              setFormData({ ...formData, service: e.target.value })
                            }
                            placeholder="Personal injury lawyer, Botox, Roof repair..."
                            className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 py-3 pl-10 pr-4 text-white placeholder:text-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            disabled={formState === "submitting"}
                          />
                        </div>
                        <p className="mt-1.5 text-xs text-zinc-500">
                          This is what we'll ask AI about
                        </p>
                      </div>

                      {/* City */}
                      <div>
                        <label
                          htmlFor="city"
                          className="mb-2 block text-sm font-medium text-zinc-300"
                        >
                          City
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
                            placeholder="Miami, FL"
                            className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 py-3 pl-10 pr-4 text-white placeholder:text-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            disabled={formState === "submitting"}
                          />
                        </div>
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
            We query the same AI systems your customers are using
          </p>

          <div className="mt-14 grid gap-8 md:grid-cols-3">
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
                <span className="text-xl font-bold">1</span>
              </div>
              <h3 className="mt-4 font-semibold text-white">We ask ChatGPT</h3>
              <p className="mt-2 text-sm text-zinc-400">
                "What's the best {"{your service}"} in {"{your city}"}?"
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400">
                <span className="text-xl font-bold">2</span>
              </div>
              <h3 className="mt-4 font-semibold text-white">We ask Claude</h3>
              <p className="mt-2 text-sm text-zinc-400">
                Same question, different AI — to see your full coverage
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
                <span className="text-xl font-bold">3</span>
              </div>
              <h3 className="mt-4 font-semibold text-white">You get results</h3>
              <p className="mt-2 text-sm text-zinc-400">
                Your GEO score, visibility status, and who AI recommends instead
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
