// APEX SENTINEL — AI reasoning implementation (server only).
// The AI never produces numbers. It receives structured quantitative evidence
// and returns interpretation only: Analyst -> Devil's Advocate -> Chief.
import { briefSchema, type ApexBrief, type ApexReasoning } from "./ai.types";

export { briefSchema };
export type { ApexBrief, ApexReasoning };

const RULES = `You are part of a quantitative market-intelligence terminal for Deriv synthetic indices.
STRICT RULES:
- Never predict a specific next digit and never claim certainty.
- Never invent probabilities, percentages or scores. Only reference numbers given to you.
- Never describe a model as validated unless its supplied status says VALIDATED. If it says NOT VALIDATED, say so plainly.
- Reason about DIGIT GROUPS: which digits win this contract, which lose it, and which side is gaining pressure.
- Always address the losing digits by name and say whether they are becoming dangerous.
- Treat small samples as weak evidence and say when a pattern is merely unusual rather than useful.
- Speak in relative, uncertainty-aware terms: "current evidence favours X relative to alternatives".
- Be concise, professional and specific. No markdown headings, no bullet symbols, max 130 words.`;

async function callGemini(system: string, user: string, apiKey: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: `${RULES}\n${system}` }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: { maxOutputTokens: 500 },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini API ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  return json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
}

async function callModel(system: string, user: string, geminiKey?: string, lovableKey?: string): Promise<string> {
  if (geminiKey) {
    return callGemini(system, user, geminiKey);
  }
  if (lovableKey) {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: `${RULES}\n${system}` },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`AI gateway ${res.status}: ${body.slice(0, 200)}`);
    }
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return json.choices?.[0]?.message?.content?.trim() ?? "";
  }
  throw new Error("No AI API key configured");
}

export async function runReasoningChain(data: ApexBrief): Promise<ApexReasoning> {
  const geminiApiKey = typeof process !== "undefined" && process.env ? process.env["GEMINI_API_KEY"] : undefined;
  const lovableApiKey =
    (typeof process !== "undefined" && process.env ? process.env["LOVABLE_API_KEY"] : undefined) ||
    (typeof import.meta !== "undefined" && (import.meta as { env?: Record<string, string> }).env
      ? (import.meta as { env?: Record<string, string> }).env?.["VITE_LOVABLE_API_KEY"]
      : undefined);

  if (!geminiApiKey && !lovableApiKey) {
    return {
      analyst: "",
      devilsAdvocate: "",
      chief: "",
      available: false,
      error: "AI unavailable — quantitative engines remain fully operational.",
    };
  }

  const facts = JSON.stringify(data, null, 1);

  try {
    const analyst = await callModel(
      "Role: PRIMARY ANALYST. Explain why this contract currently ranks first. Structure your answer as: what the winning digit group is doing; what the losing digits are doing and whether they are becoming dangerous; what the validated models and statistics actually support; and what would invalidate this.",
      facts,
      geminiApiKey,
      lovableApiKey,
    );
    const devilsAdvocate = await callModel(
      "Role: DEVIL'S ADVOCATE. Attack this ranking. Ask whether the edge is just a short-window hit rate, whether the sample is large enough, whether losing digits are quietly building, whether critical digit structures contradict the direction, and whether any model is genuinely validated. Name the strongest specific reason this could be a fake edge.",
      `${facts}\n\nPRIMARY ANALYST SAID:\n${analyst}`,
      geminiApiKey,
      lovableApiKey,
    );
    const chief = await callModel(
      "Role: CHIEF INTELLIGENCE. Resolve the disagreement using only the supplied evidence. State the losing-digit threat explicitly, state the level of uncertainty, and end with a clear stance: PROCEED WITH CAUTION, MONITOR, or STAND DOWN.",
      `${facts}\n\nANALYST:\n${analyst}\n\nDEVIL'S ADVOCATE:\n${devilsAdvocate}`,
      geminiApiKey,
      lovableApiKey,
    );
    return { analyst, devilsAdvocate, chief, available: true };
  } catch (err) {
    return {
      analyst: "",
      devilsAdvocate: "",
      chief: "",
      available: false,
      error:
        err instanceof Error
          ? `AI interpretation unavailable (${err.message.slice(0, 120)}) — quantitative engines unaffected.`
          : "AI interpretation unavailable — quantitative engines unaffected.",
    };
  }
}
