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
    const prompt = `
Return ONLY a valid JSON array.
No markdown. No backticks.
Each object must have:
title, overview, poster_path (string or null), vote_average (number).

User prompt: ${req.body.prompt}
`;

    const response = await openai.responses.create({
      model: "gpt-4o-mini",
      input: prompt,
    });

    let text =
      response.output_text ||
      response.output?.[0]?.content?.[0]?.text ||
      "";

    // 🔥 STRIP ```json ``` WRAPPERS (CRITICAL)
    text = text.replace(/```json|```/g, "").trim();

    const movies = JSON.parse(text);

    res.json(movies);
  } catch (err) {
    console.error("AI ERROR:", err.message);
    res.json([]); // ALWAYS return array
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

