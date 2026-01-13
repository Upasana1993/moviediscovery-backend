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
    const aiPrompt = `
Return ONLY a JSON array of 8 movie titles.
No markdown. No explanation.
Prompt: ${req.body.prompt}
`;

    const ai = await openai.responses.create({
      model: "gpt-4o-mini",
      input: aiPrompt,
    });

    const titles = JSON.parse(ai.output_text);

    // Search TMDB for each title
    const results = [];
    for (const title of titles) {
      const search = await TMDB.get("/search/movie", {
        params: { query: title },
      });
      if (search.data.results.length > 0) {
        results.push(search.data.results[0]);
      }
    }

    res.json({ results });
  } catch (err) {
    console.error("AI error:", err.message);
    res.status(500).json({ results: [] });
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

