import { useEffect, useMemo, useState } from "react";

const defaultForm = {
  name: "",
  age: "",
  weight: "",
  height: "",
  goal: "Fat Loss",
  dietType: "vegetarian",
  activityLevel: "moderate",
  allergies: "",
};

const GOAL_MAP = {
  "Fat Loss": "weight_loss",
  "Muscle Gain": "muscle_gain",
  Maintenance: "maintenance",
};

const API_KEY_STORAGE = "demo_gym_groq_api_key";
const BASE_URL = "https://ai-diet-planner-a61g.onrender.com";

function App() {
  const [form, setForm] = useState(defaultForm);
  const [plan, setPlan] = useState(null);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [savedApiKey, setSavedApiKey] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const displayName = useMemo(() => form.name?.trim() || "Athlete", [form.name]);
  const hasSavedKey = Boolean(savedApiKey);

  useEffect(() => {
    const key = localStorage.getItem(API_KEY_STORAGE) || "";
    setSavedApiKey(key);
    setApiKeyInput(key);
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveKey = () => {
    const trimmed = apiKeyInput.trim();
    if (!trimmed) {
      setErrorMessage("Please enter your API key");
      setStatusMessage("");
      return;
    }
    localStorage.setItem(API_KEY_STORAGE, trimmed);
    setSavedApiKey(trimmed);
    setErrorMessage("");
    setStatusMessage("API key saved successfully");
  };

  const handleClearKey = () => {
    localStorage.removeItem(API_KEY_STORAGE);
    setSavedApiKey("");
    setApiKeyInput("");
    setStatusMessage("API key cleared");
    setErrorMessage("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatusMessage("");
    setErrorMessage("");

    if (!savedApiKey) {
      setErrorMessage("Please enter your API key");
      return;
    }

    setIsLoading(true);
    try {
      const payload = {
        name: form.name.trim(),
        age: Number(form.age),
        weight: Number(form.weight),
        height: Number(form.height),
        goal: GOAL_MAP[form.goal],
        diet_type: form.dietType,
        allergies: form.allergies.trim(),
        activity_level: form.activityLevel,
      };

      const response = await fetch(`${BASE_URL}/generate-diet`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${savedApiKey}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Failed to generate plan");
      }

      setPlan({
        generatedFor: displayName,
        profile: {
          age: form.age || "N/A",
          weight: form.weight ? `${form.weight} kg` : "N/A",
          height: form.height ? `${form.height} cm` : "N/A",
          goal: form.goal,
        },
        ...data,
      });
    } catch (error) {
      setErrorMessage(error.message || "Unable to generate plan right now");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="app-shell">
      <div className="ambient ambient-a" />
      <div className="ambient ambient-b" />

      <header className="hero section">
        <p className="kicker">Premium Fitness Intelligence</p>
        <h1>DEMO GYM AI DIET PLANNER</h1>
        <p className="subtitle">AI-powered nutrition for real results</p>
        <a href="#planner" className="btn btn-primary">
          Generate Plan
        </a>
      </header>

      <main className="content">
        <section id="planner" className="section planner-grid">
          <article className="glass-card form-card fade-in">
            <h2>Create Your Personalized Plan</h2>
            <p className="muted">
              Enter client details and instantly present a premium AI-style diet report.
            </p>
            <div className="key-wrap">
              <label>
                Enter your Groq API Key
                <input
                  type="password"
                  placeholder="gsk_..."
                  value={apiKeyInput}
                  onChange={(event) => setApiKeyInput(event.target.value)}
                />
              </label>
              <p className="helper-text">
                Your API key is stored locally and never saved on server.
              </p>
              <div className="key-actions">
                <button type="button" className="btn btn-glow" onClick={handleSaveKey}>
                  Save Key
                </button>
                <button type="button" className="btn btn-secondary" onClick={handleClearKey}>
                  Clear API Key
                </button>
              </div>
            </div>

            {statusMessage ? <p className="feedback-ok">{statusMessage}</p> : null}
            {errorMessage ? <p className="feedback-error">{errorMessage}</p> : null}

            <form onSubmit={handleSubmit} className="planner-form">
              <label>
                Name
                <input
                  type="text"
                  name="name"
                  placeholder="Enter full name"
                  value={form.name}
                  onChange={handleChange}
                  required
                />
              </label>

              <div className="inline-grid">
                <label>
                  Age
                  <input
                    type="number"
                    name="age"
                    min="12"
                    max="100"
                    placeholder="24"
                    value={form.age}
                    onChange={handleChange}
                    required
                  />
                </label>
                <label>
                  Goal
                  <select name="goal" value={form.goal} onChange={handleChange}>
                    <option>Fat Loss</option>
                    <option>Muscle Gain</option>
                    <option>Maintenance</option>
                  </select>
                </label>
              </div>

              <div className="inline-grid">
                <label>
                  Weight (kg)
                  <input
                    type="number"
                    name="weight"
                    min="30"
                    max="250"
                    placeholder="75"
                    value={form.weight}
                    onChange={handleChange}
                    required
                  />
                </label>
                <label>
                  Height (cm)
                  <input
                    type="number"
                    name="height"
                    min="120"
                    max="250"
                    placeholder="175"
                    value={form.height}
                    onChange={handleChange}
                    required
                  />
                </label>
              </div>

              <div className="inline-grid">
                <label>
                  Diet Type
                  <select name="dietType" value={form.dietType} onChange={handleChange}>
                    <option value="vegetarian">Vegetarian</option>
                    <option value="non-vegetarian">Non-Vegetarian</option>
                    <option value="vegan">Vegan</option>
                    <option value="eggetarian">Eggetarian</option>
                  </select>
                </label>
                <label>
                  Activity Level
                  <select name="activityLevel" value={form.activityLevel} onChange={handleChange}>
                    <option value="sedentary">Sedentary</option>
                    <option value="light">Light</option>
                    <option value="moderate">Moderate</option>
                    <option value="active">Active</option>
                  </select>
                </label>
              </div>

              <label>
                Allergies / Restrictions (optional)
                <input
                  type="text"
                  name="allergies"
                  placeholder="e.g., peanuts, lactose"
                  value={form.allergies}
                  onChange={handleChange}
                />
              </label>

              <button type="submit" className="btn btn-glow" disabled={!hasSavedKey || isLoading}>
                {isLoading ? (
                  <>
                    <span className="spinner" aria-hidden="true" />
                    Generating...
                  </>
                ) : (
                  "Generate AI Plan"
                )}
              </button>
              {!hasSavedKey ? (
                <p className="helper-text">Save your API key to enable plan generation.</p>
              ) : null}
            </form>
          </article>

          <article className="glass-card report-card fade-in">
            <h2>AI Diet Report</h2>
            {!plan ? (
              <div className="report-placeholder">
                <p>Your premium plan preview appears here after generation.</p>
                <p className="muted">Designed for client-ready gym presentations.</p>
              </div>
            ) : (
              <div className="report-body">
                <div className="report-top">
                  <div>
                    <h3>{plan.generatedFor}</h3>
                    <p className="muted">
                      {plan.profile.goal} Plan | {plan.profile.age} yrs
                    </p>
                  </div>
                  <span className="pill">{plan.calories || "Custom Plan"}</span>
                </div>

                <div className="metrics">
                  <span>Weight: {plan.profile.weight}</span>
                  <span>Height: {plan.profile.height}</span>
                </div>

                <div className="meal-grid">
                  {Object.entries(plan.meals || {}).map(([mealTitle, mealData]) => (
                    <div className="meal-card" key={mealTitle}>
                      <h4>{mealTitle.replaceAll("_", " ")}</h4>
                      <p>{mealData}</p>
                    </div>
                  ))}
                </div>

                <div className="tip-box">
                  <strong>Coach Tip:</strong> {plan.tips || plan.tip || "Stay consistent and track your meals daily."}
                </div>
              </div>
            )}
          </article>
        </section>

        <section className="section features">
          <h2>Why Gym Owners Choose This Product</h2>
          <div className="feature-grid">
            <article className="feature-card">
              <h3>AI Powered Plans</h3>
              <p>
                Deliver modern, intelligent diet recommendations in seconds and stand out from nearby
                gyms.
              </p>
            </article>
            <article className="feature-card">
              <h3>Personalized Nutrition</h3>
              <p>
                Tailor plans by goals and profile data for every member while keeping quality
                consistently high.
              </p>
            </article>
            <article className="feature-card">
              <h3>Gym Business Growth</h3>
              <p>
                Increase retention and premium package conversions with a branded nutrition
                experience.
              </p>
            </article>
          </div>
        </section>

        <section className="section cta">
          <div className="glass-card cta-card">
            <h2>Upgrade your gym with AI</h2>
            <p>Turn nutrition planning into a high-value service your clients will remember.</p>
            <button className="btn btn-primary" type="button">
              Contact Now
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
