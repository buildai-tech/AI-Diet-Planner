const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const Groq = require("groq-sdk");
const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");
const dotenv = require("dotenv");
dotenv.config();

// ─── INIT ────────────────────────────────────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 5000;

// ─── MIDDLEWARE ───────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || "*",
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(express.json({ limit: "10kb" }));

// Rate limiting: 20 requests per 15 minutes per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: "Too many requests. Please wait 15 minutes before trying again." },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/generate-diet", limiter);

// ─── DATABASE (MongoDB — optional, falls back gracefully) ─────────────────────
let DietPlan;
if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log("✅ MongoDB connected"))
    .catch(err => console.warn("⚠️  MongoDB connection failed, using in-memory fallback:", err.message));

  const dietPlanSchema = new mongoose.Schema({
    planId: { type: String, unique: true, default: () => uuidv4() },
    name: String,
    age: Number,
    weight: Number,
    height: Number,
    goal: String,
    diet_type: String,
    allergies: String,
    activity_level: String,
    result: mongoose.Schema.Types.Mixed,
    createdAt: { type: Date, default: Date.now },
  });
  DietPlan = mongoose.models.DietPlan || mongoose.model("DietPlan", dietPlanSchema);
}

// In-memory fallback store (stores last 100 plans)
const memoryStore = [];

// ─── VALIDATION ───────────────────────────────────────────────────────────────
function validateInput({ name, age, weight, height, goal, diet_type }) {
  const errors = [];
  if (!name || typeof name !== "string" || name.trim().length < 2) errors.push("Name must be at least 2 characters.");
  if (!age || isNaN(age) || age < 10 || age > 100) errors.push("Age must be between 10 and 100.");
  if (!weight || isNaN(weight) || weight < 20 || weight > 300) errors.push("Weight must be between 20 and 300 kg.");
  if (!height || isNaN(height) || height < 100 || height > 250) errors.push("Height must be between 100 and 250 cm.");
  const validGoals = ["weight_loss", "muscle_gain", "maintenance"];
  if (!goal || !validGoals.includes(goal)) errors.push("Goal must be weight_loss, muscle_gain, or maintenance.");
  const validDiets = ["vegetarian", "non-vegetarian", "vegan", "eggetarian"];
  if (!diet_type || !validDiets.includes(diet_type)) errors.push("Invalid diet type.");
  return errors;
}

// ─── PROMPT BUILDER ───────────────────────────────────────────────────────────
function buildPrompt({ name, age, weight, height, goal, diet_type, allergies, activity_level }) {
  const goalMap = {
    weight_loss: "weight loss (caloric deficit)",
    muscle_gain: "muscle gain and bodybuilding (caloric surplus with high protein)",
    maintenance: "maintaining current weight and general fitness",
  };

  const activityMap = {
    sedentary: "sedentary (desk job, minimal movement)",
    light: "lightly active (1–2 workouts per week)",
    moderate: "moderately active (3–5 workouts per week)",
    active: "very active (daily intense training)",
  };

  const bmi = (weight / ((height / 100) ** 2)).toFixed(1);
  const allergyText = allergies?.trim() ? `Allergies/restrictions: ${allergies}` : "No known allergies.";

  return `You are an expert Indian sports nutritionist and dietitian. Create a detailed, practical, one-day Indian diet plan in structured JSON format.

CLIENT PROFILE:
- Name: ${name}
- Age: ${age} years
- Weight: ${weight} kg
- Height: ${height} cm
- BMI: ${bmi}
- Goal: ${goalMap[goal]}
- Diet preference: ${diet_type}
- Activity level: ${activityMap[activity_level] || "moderate"}
- ${allergyText}

REQUIREMENTS:
1. All meals MUST be Indian-friendly (use common Indian foods: dal, roti, rice, sabzi, idli, dosa, poha, upma, paneer, curd, etc.)
2. Include specific quantities (grams, cups, pieces)
3. Be practical and affordable — no exotic ingredients
4. Respect the diet type strictly (${diet_type})
5. Avoid ALL allergens mentioned
6. Calorie and macro targets must match the goal

Respond ONLY with valid JSON in EXACTLY this format (no markdown, no explanation, just raw JSON):
{
  "calories": "Total daily calories (e.g., 1800 kcal)",
  "macros": {
    "protein": "e.g., 140g (31%)",
    "carbs": "e.g., 180g (40%)",
    "fats": "e.g., 60g (30%)"
  },
  "meals": {
    "breakfast": "Detailed breakfast with quantities and calorie estimate",
    "mid_morning": "Mid-morning snack with quantities",
    "lunch": "Detailed lunch with quantities and calorie estimate",
    "evening_snack": "Evening snack with quantities",
    "dinner": "Detailed dinner with quantities and calorie estimate",
    "pre_workout": "Pre/post workout meal or note if not applicable"
  },
  "tips": "5 practical, personalised diet tips for this person's goal and profile. Be specific, not generic.",
  "hydration": "Daily water intake recommendation and timing, including coconut water or nimbu pani if beneficial.",
  "supplements": "If relevant, suggest 2-3 basic supplements (protein powder, creatine, etc.) with dosage. If not needed, say why."
}`;
}

// ─── GROQ API CALL ────────────────────────────────────────────────────────────
async function generateDietPlan(userData, groq) {
  const prompt = buildPrompt(userData);

  const completion = await groq.chat.completions.create({
    messages: [
      {
        role: "system",
        content: "You are an expert Indian sports nutritionist. Always respond with raw, valid JSON only — no markdown, no backticks, no explanation text before or after the JSON."
      },
      { role: "user", content: prompt },
    ],
    model: process.env.GROQ_MODEL || "llama3-70b-8192",
    temperature: 0.6,
    max_tokens: 2000,
    top_p: 0.9,
  });

  const rawText = completion.choices[0]?.message?.content?.trim();
  if (!rawText) throw new Error("No response from AI. Please try again.");

  // Clean up in case model adds markdown fences
  const cleaned = rawText.replace(/^```json\n?/, "").replace(/\n?```$/, "").trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    // Attempt to extract JSON from response
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error("AI returned malformed data. Please try again.");
  }
}

// ─── ROUTES ───────────────────────────────────────────────────────────────────

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "Demo Gym AI Diet Planner", timestamp: new Date().toISOString() });
});

// Main endpoint
app.post("/generate-diet", async (req, res) => {
  try {
    const apiKey = req.headers.authorization?.split(" ")[1];
    if (!apiKey) {
      return res.status(401).json({ error: "API key missing" });
    }
    const groq = new Groq({ apiKey });

    const { name, age, weight, height, goal, diet_type, allergies, activity_level } = req.body;

    // Sanitise inputs
    const sanitised = {
      name: String(name || "").trim(),
      age: Number(age),
      weight: Number(weight),
      height: Number(height),
      goal: String(goal || "").trim(),
      diet_type: String(diet_type || "").trim(),
      allergies: String(allergies || "").trim().substring(0, 200),
      activity_level: String(activity_level || "moderate").trim(),
    };

    // Validate
    const errors = validateInput(sanitised);
    if (errors.length > 0) {
      return res.status(400).json({ error: errors.join(" "), details: errors });
    }

    // Generate diet plan via Groq
    console.log(`🍽️  Generating plan for ${sanitised.name} (${sanitised.goal}, ${sanitised.diet_type})`);
    const planData = await generateDietPlan(sanitised, groq);

    const planId = uuidv4();
    const result = { planId, ...planData };

    // Save to DB (async, don't block response)
    const record = { planId, ...sanitised, result, createdAt: new Date() };
    if (DietPlan) {
      new DietPlan(record).save().catch(err => console.warn("DB save failed:", err.message));
    } else {
      memoryStore.push(record);
      if (memoryStore.length > 100) memoryStore.shift(); // keep last 100
    }

    console.log(`✅ Plan generated for ${sanitised.name} — ${planData.calories}`);
    return res.status(200).json(result);

  } catch (err) {
    console.error("ERROR:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Get saved plan by ID
app.get("/plans/:planId", async (req, res) => {
  try {
    const { planId } = req.params;
    let plan;
    if (DietPlan) {
      plan = await DietPlan.findOne({ planId }).select("-__v");
    } else {
      plan = memoryStore.find(p => p.planId === planId);
    }
    if (!plan) return res.status(404).json({ error: "Plan not found." });
    res.json(plan);
  } catch (err) {
    res.status(500).json({ error: "Failed to retrieve plan." });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Route not found." });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "An unexpected error occurred." });
});

// ─── START ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`
🚀 Demo Gym AI Diet Planner Backend
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Server:  http://localhost:${PORT}
  Health:  http://localhost:${PORT}/health
  Model:   ${process.env.GROQ_MODEL || "llama3-70b-8192"}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `);
});

module.exports = app;