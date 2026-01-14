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

const IMG = "https://image.tmdb.org/t/p/w500";

/* ---------------- WATCH PROVIDERS ---------------- */
async function getWatchProviders(movieId) {
  try {
    const res = await TMDB.get(`/movie/${movieId}/watch/providers`);
    const india = res.data.results?.IN || {};

    const all = [
      ...(india.flatrate || []),
      ...(india.buy || []),
      ...(india.rent || []),
    ].map((p) => p.provider_name.toLowerCase());

    return {
      netflix: all.includes("netflix"),
      prime: all.includes("amazon prime video"),
      bookmyshow: all.includes("bookmyshow"),
    };
  } catch {
    return {};
  }
}

/* ---------------- ENRICH MOVIE ---------------- */
async function enrichMovie(tmdbMovie, fallback) {
  if (!tmdbMovie) {
    return {
      id: fallback.title,
      title: fallback.title,
      overview: fallback.overview,
      poster: null,
      rating: null,
      release_date: null,
      providers: {},
    };
  }

  const providers = await getWatchProviders(tmdbMovie.id);

  return {
    id: tmdbMovie.id,
    title: tmdbMovie.title,
    overview: tmdbMovie.overview,
    poster: tmdbMovie.poster_path ? IMG + tmdbMovie.poster_path : null,
    rating: tmdbMovie.vote_average,
    release_date: tmdbMovie.release_date,
    providers,
  };
}

/* ---------------- AI RECOMMEND ---------------- */
app.post("/recommend", async (req, res) => {
  try {
    const aiPrompt = `
Suggest 5 movies.
Return ONLY a valid JSON array.
Each item must have:
- title
- overview

Request: ${req.body.prompt}
`;

    const aiResponse = await openai.responses.create({
      model: "gpt-4o-mini",
      input: aiPrompt,
    });

    const raw =
      aiResponse.output?.[0]?.content?.[0]?.text || "";

    const clean = raw.replace(/```json|```/g, "").trim();
    const aiMovies = JSON.parse(clean);

    const results = await Promise.all(
      aiMovies.map(async (movie) => {
        const tmdbRes = await TMDB.get("/search/movie", {
          params: { query: movie.title },
        });
        return enrichMovie(tmdbRes.data.results[0], movie);
      })
    );

    res.json({ results });
  } catch (e) {
    console.error("AI error:", e.message);
    res.status(500).json({ results: [] });
  }
});

/* ---------------- TRENDING ---------------- */
app.get("/trending", async (_, res) => {
  const data = await TMDB.get("/trending/movie/week");
  const enriched = await Promise.all(
    data.data.results.slice(0, 10).map((m) => enrichMovie(m, m))
  );
  res.json(enriched);
});

/* ---------------- LATEST ---------------- */
app.get("/latest", async (_, res) => {
  const data = await TMDB.get("/movie/now_playing");
  const enriched = await Promise.all(
    data.data.results.slice(0, 10).map((m) => enrichMovie(m, m))
  );
  res.json(enriched);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log("Backend running on port", PORT)
);
