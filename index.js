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

    const rawText =
      aiResponse.output?.[0]?.content?.[0]?.text || "";

    const cleanJson = rawText
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const aiMovies = JSON.parse(cleanJson);

    // enrich via TMDB
    const enriched = await Promise.all(
      aiMovies.map(async (movie) => {
        try {
          const tmdbRes = await TMDB.get("/search/movie", {
            params: { query: movie.title },
          });

          const tmdbMovie = tmdbRes.data.results[0];

          return {
            id: tmdbMovie?.id || movie.title,
            title: movie.title,
            overview: movie.overview,
            poster_path: tmdbMovie?.poster_path || null,
            vote_average: tmdbMovie?.vote_average || null,
            release_date: tmdbMovie?.release_date || null,
          };
        } catch {
          return {
            id: movie.title,
            title: movie.title,
            overview: movie.overview,
            poster_path: null,
            vote_average: null,
            release_date: null,
          };
        }
      })
    );

    res.json({ results: enriched });
  } catch (err) {
    console.error("AI recommend error:", err.message);
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

