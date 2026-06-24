import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export async function POST(req: Request) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let issues: any[] = [];
  try {
    const body = await req.json();
    issues = body.issues;
    
    if (!issues || !Array.isArray(issues)) {
      return NextResponse.json({ error: "Missing or invalid issues array" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Gemini API key is not configured on the server.");
    }

    const ai = new GoogleGenAI({ apiKey });

    // Format issues list for the model prompt
    const issuesSummary = issues.map((issue, idx) => {
      return `${idx + 1}. [Category: ${issue.category}] [Issue: ${issue.subcategory}] [Severity: ${issue.severity}] [Status: ${issue.status}]
      Location: ${issue.location.grid} (Lat: ${issue.location.latitude.toFixed(4)}, Lng: ${issue.location.longitude.toFixed(4)})
      Summary: ${issue.short_summary}
      Upvotes: ${issue.upvotes}`;
    }).join("\n\n");

    const prompt = `You are a Chief Urban policy and Infrastructure Planner. Analyze the following live citizen telemetry data detailing active civic issues in the neighborhood:

${issuesSummary || "No active issues reported in this grid."}

Please synthesize a Municipal Policy Advisory Report. Provide your response formatted with clean Markdown. Structure it into the following sections:
1. 🔍 **Neighborhood Vulnerability Index**: Rank the overall quality scores (A+ to F) for Category sectors (Roads, Public Safety, Sanitation, and General Infrastructure) based on current reports.
2. 🚨 **High-Priority Hotspots**: Identify specific geographical hotspots requiring immediate deployment (e.g. coordinate grids, intersections, specific sectors).
3. 🛠️ **Engineering Action Items**: Outline specific immediate maintenance instructions for municipal dispatch crews.
4. 🔮 **Predictive Prevention Insights**: Suggest proactive preventative policy measures to avert future failures in these categories.
5. 📊 **Community Carbon & Cost Savings**: Provide a simulated estimate of the positive impact of resolving these issues early (e.g., prevention of water erosion, savings in car suspension damage costs, carbon impact of timely street clearing).

Make the report sound technical, highly professional, futuristic, and actionable.`;

    console.log("Invoking Gemini 2.5 Flash for Municipal Policy Recommendations...");

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [prompt],
      config: {
        systemInstruction: "You are a professional Chief Urban Planner and Infrastructure Analyst. Speak with authority, using domain-specific terms (e.g. asphalt fatigue, grid density, luminance threshold, load optimization)."
      }
    });

    const responseText = response.text;
    if (!responseText) {
      return NextResponse.json({ error: "No response received from Gemini" }, { status: 500 });
    }

    return NextResponse.json({ recommendations: responseText });
  } catch (error: unknown) {
    console.error("API Recommendations Error (Gemini call failed, running local fallback):", error);
    
    // Dynamic fallback disclaimer based on error reason
    let disclaimer = "*Note: The Gemini API is currently disabled or key is inactive in your Google Console. This report has been synthesized using our local rule-based policy engine.*";
    if (error && typeof error === "object") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const errObj = error as any;
      const errMsg = errObj.message || "";
      if (errObj.status === 503 || errMsg.includes("503") || errMsg.toLowerCase().includes("demand") || errMsg.toLowerCase().includes("unavailable")) {
        disclaimer = "*Note: The Gemini API model is currently experiencing temporary high demand (503 Service Unavailable). This report has been dynamically generated using our local rule-based policy engine. Please try again in a few moments.*";
      } else if (errObj.status === 429 || errMsg.includes("429") || errMsg.toLowerCase().includes("quota") || errMsg.toLowerCase().includes("rate limit")) {
        disclaimer = "*Note: The Gemini API free tier rate limit or daily quota has been exceeded. This report has been dynamically generated using our local rule-based policy engine.*";
      }
    }

    // Dynamic fallback generation based on issues count
    const roadsIssues = issues.filter(i => i.category.toLowerCase().includes("road"));
    const safetyIssues = issues.filter(i => i.category.toLowerCase().includes("safety") || i.category.toLowerCase().includes("light"));
    const sanitationIssues = issues.filter(i => i.category.toLowerCase().includes("sanit") || i.category.toLowerCase().includes("trash"));

    const fallbackReport = `# Municipal Policy Advisory Report (Local Fallback Console)
${disclaimer}

## 🔍 Neighborhood Vulnerability Index
* 🛣️ **Roads & Pavements**: **Grade ${roadsIssues.length > 0 ? "C-" : "A"}** (${roadsIssues.length} active asphalt fatigue incidents).
* 💡 **Public Safety & lighting**: **Grade ${safetyIssues.length > 0 ? "B-" : "A"}** (${safetyIssues.length} dark corridor lighting outages).
* ♻️ **Sanitation & Waste**: **Grade ${sanitationIssues.length > 0 ? "B" : "A"}** (${sanitationIssues.length} active smart-bin overflow reports).

## 🚨 High-Priority Hotspots
${issues.length === 0 ? "* No active issues reported in this grid." : issues.slice(0, 3).map((issue, idx) => {
  return `* **Hotspot #${idx + 1} (${issue.subcategory})**: Coordinates: \`${issue.location.latitude.toFixed(4)}, ${issue.location.longitude.toFixed(4)}\` — Severity: **${issue.severity}**. Impact: ${issue.short_summary}`;
}).join("\n")}

## 🛠️ Engineering Action Items
${issues.length === 0 ? "1. General patrol of all sectors to confirm asset status." : issues.slice(0, 3).map((issue, idx) => {
  return `${idx + 1}. **Deploy Dispatch**: Mobilize repair team to coordinate \`${issue.location.latitude.toFixed(4)}, ${issue.location.longitude.toFixed(4)}\` to address the **${issue.subcategory}** hazard. Apply appropriate standards.`;
}).join("\n")}

## 🔮 Predictive Prevention Insights
* **Structural Pavement Degradation**: Early sealing of road micro-fractures prevents deep water erosion and saves up to 75% in reconstruction costs.
* **Lighting Outage Telemetry**: Install smart photo-sensors on streetlamp grids to automatically report failures via IoT nodes before citizen complaints.
* **Waste Routing Optimization**: Reroute municipal trucks dynamically based on sensor load factors reaching 85% volumetric threshold.

## 📊 Community Carbon & Cost Savings
* 💰 **Commuter Savings**: Resolving road hazards early avoids vehicle suspension damage, saving commuters an estimated **₹50,000+** in aggregate repairs.
* 🌿 **Carbon Impact**: Direct routing of garbage collection reduces truck idle fuel usage by **15%**, avoiding excess carbon emissions.
* 🛡️ **Accident Mitigation**: Restoring lighting reduces dusk/dawn accidents by **35%** in high-density commercial corridors.`;

    return NextResponse.json({ recommendations: fallbackReport });
  }
}
