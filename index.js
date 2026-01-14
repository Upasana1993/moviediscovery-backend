require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const OpenAI = require("openai");

const app = express();
app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const TMDB = axios.create({
  baseURL: "https://api.themoviedb.org/3",
  params: {
    api_key: process.env.TMDB_API_KEY,
    region: "IN",
  },
});

/* ---------------- AI RECOMMEND ---------------- */
app.post("/recommend", async (req, res) => {
  try {
    console.log("📥 Prompt received:", req.body.prompt);

    const aiPrompt = `
Suggest 5 movies for this request.
Return ONLY a JSON array.
Each item must contain:
- title
- overview

Request: ${req.body.prompt}
`;

    const aiResponse = await openai.responses.create({
      model: "gpt-4o-mini",
      input: aiPrompt,
    });

    // 🔥 LOG EVERYTHING
    console.log("🧠 FULL AI RESPONSE:");
    console.dir(aiResponse, { depth: null });

    const message =
      aiResponse.output?.[0]?.content?.[0]?.text;

    console.log("🧠 EXTRACTED TEXT:", message);

    if (!message) {
      return res.status(500).json({
        error: "No AI text output",
        raw: aiResponse,
      });
    }

    const aiMovies = JSON.parse(message);

    res.json({ results: aiMovies });
  } catch (err) {
    console.error("❌ AI ERROR:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ---------------- TRENDING ---------------- */
app.get("/trending", async (_, res) => {
  const data = await TMDB.get("/trending/movie/week");
  res.json(data.data.results.slice(0, 10));
});

/* ---------------- LATEST ---------------- */
app.get("/latest", async (_, res) => {
  const data = await TMDB.get("/movie/now_playing");
  res.json(data.data.results.slice(0, 10));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log("Backend running on port", PORT)
);

