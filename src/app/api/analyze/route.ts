import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export async function POST(req: Request) {
  let file: File | null = null;
  try {
    const formData = await req.formData();
    file = formData.get("image") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Missing image file" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Data = buffer.toString("base64");
    const mimeType = file.type || "image/jpeg";

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Gemini API key is not configured on the server.");
    }

    const ai = new GoogleGenAI({ apiKey });

    console.log("Invoking Gemini 3.1 Flash-Lite for civic issue analysis...");
    
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: [
        { text: "Analyze the uploaded image of a civic issue and output structured classification." },
        { inlineData: { mimeType, data: base64Data } }
      ],
      config: {
        systemInstruction: "You are an expert civic issue visual analyzer. Carefully evaluate the visual evidence in the image (such as potholes, broken lights, trash, or safety hazards) to classify it into appropriate categories, provide a technical summary, and generate an autonomous dispatch action plan. Always choose standard categories (Roads, Public Safety, Sanitation, Infrastructure) and provide exact severity assessment LEVEL 1 to 4.",
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            category: { 
              type: "STRING", 
              description: "The primary category. Must be one of: Roads, Public Safety, Sanitation, or Infrastructure." 
            },
            subcategory: { 
              type: "STRING", 
              description: "A specific subcategory, e.g. Pavement Deformation, Streetlight Malfunction, Recycling Overflow, Exposed High-Voltage Node." 
            },
            severity: { 
              type: "STRING", 
              description: "Severity LEVEL: LEVEL 1 (Low), LEVEL 2 (Medium), LEVEL 3 (High), or LEVEL 4 (Critical)." 
            },
            short_summary: { 
              type: "STRING", 
              description: "A concise 1-2 sentence technical summary of the visual evidence." 
            },
            keywords: { 
              type: "ARRAY", 
              items: { type: "STRING" }, 
              description: "Keywords related to the issue." 
            },
            actionPlan: {
              type: "OBJECT",
              description: "An autonomous repair dispatch work order details.",
              properties: {
                department: { 
                  type: "STRING", 
                  description: "The municipal agency responsible for repairing this issue, e.g. 'Road Maintenance Division', 'City Power Grid Department', 'Sanitation & Solid Waste Management'." 
                },
                tools: { 
                  type: "ARRAY", 
                  items: { type: "STRING" }, 
                  description: "Tools, materials, and equipment required to resolve the issue (e.g. cold-mix asphalt, LED luminaires, replacement bags)." 
                },
                safety: { 
                  type: "ARRAY", 
                  items: { type: "STRING" }, 
                  description: "Recommended safety rules for repair crews and citizens during operations (e.g. traffic cones, high-voltage gloves)." 
                },
                priority: { 
                  type: "STRING", 
                  description: "Routing dispatch urgency priority: Low, Medium, High, or Critical." 
                }
              },
              required: ["department", "tools", "safety", "priority"]
            }
          },
          required: ["category", "subcategory", "severity", "short_summary", "keywords", "actionPlan"]
        }
      }
    });

    const responseText = response.text;
    if (!responseText) {
      return NextResponse.json({ error: "No response text received from Gemini" }, { status: 500 });
    }

    console.log("Gemini raw response text:", responseText);

    // Clean code fence formatting if the model wrapped it, though responseMimeType should prevent it
    let cleanText = responseText.trim();
    if (cleanText.startsWith("```")) {
      const lines = cleanText.split("\n");
      const filtered = lines.filter(l => !l.trim().startsWith("```"));
      cleanText = filtered.join("\n");
    }

    const parsedData = JSON.parse(cleanText);
    return NextResponse.json(parsedData);
  } catch (error: unknown) {
    console.error("API Analyze Error (Gemini call failed, running local fallback):", error);
    
    // Smart Fallback Classifier
    const fileNameLower = (file?.name || "").toLowerCase();
    let category = "Roads";
    let subcategory = "Crater Formation (Local Fallback)";
    let severity = "LEVEL 3";
    let short_summary = "Visual anomalies detected on asphalt surface. Structural pavement deformation observed. (Note: Gemini API is disabled or key is inactive, running in local fallback mode)";
    let keywords = ["pothole", "asphalt", "local-fallback"];
    
    let actionPlan = {
      department: "Road Maintenance Division (Local Fallback)",
      tools: ["Cold-mix asphalt patch", "Vibratory tamper", "Safety cones"],
      safety: ["Divert vehicle traffic", "Wear high-visibility clothing"],
      priority: "High"
    };

    if (fileNameLower.includes("light") || fileNameLower.includes("lamp") || fileNameLower.includes("dark") || fileNameLower.includes("bulb") || fileNameLower.includes("night")) {
      category = "Public Safety";
      subcategory = "Streetlight Malfunction (Local Fallback)";
      severity = "LEVEL 2";
      short_summary = "Luminance threshold is zero. Dark corridor defect detected. (Note: Gemini API is disabled or key is inactive, running in local fallback mode)";
      keywords = ["lighting", "darkness", "local-fallback"];
      actionPlan = {
        department: "Municipal Power Grid Dept (Local Fallback)",
        tools: ["Bucket truck", "Replacement LED luminaire", "Multimeter"],
        safety: ["High-voltage insulation gloves", "Secure work zone"],
        priority: "Medium"
      };
    } else if (fileNameLower.includes("trash") || fileNameLower.includes("bin") || fileNameLower.includes("waste") || fileNameLower.includes("overflow") || fileNameLower.includes("garbage") || fileNameLower.includes("litter")) {
      category = "Sanitation";
      subcategory = "Recycling Overflow (Local Fallback)";
      severity = "LEVEL 2";
      short_summary = "Volumetric bin capacity exceeded. Refuse accumulation on footpaths. (Note: Gemini API is disabled or key is inactive, running in local fallback mode)";
      keywords = ["trash", "recycling", "local-fallback"];
      actionPlan = {
        department: "Sanitation & Solid Waste Management (Local Fallback)",
        tools: ["Compactor truck", "Cleaning disinfectant spray", "Replacement liners"],
        safety: ["Industrial waste gloves", "Pathogen protection masks"],
        priority: "Low"
      };
    }

    return NextResponse.json({
      category,
      subcategory,
      severity,
      short_summary,
      keywords,
      actionPlan
    });
  }
}
