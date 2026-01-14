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

/* ---------------- FIND BEST TMDB MATCH ---------------- */
async function findBestTMDBMovie(title) {
  const res = await TMDB.get("/search/movie", {
    params: { query: title },
  });

  if (!res.data.results?.length) return null;

  // pick highest popularity + vote_count
  return res.data.results.sort(
    (a, b) =>
      b.popularity + b.vote_count - (a.popularity + a.vote_count)
  )[0];
}

/* ---------------- ENRICH MOVIE ---------------- */
async function enrichMovie(movie) {
  const tmdbMovie = await findBestTMDBMovie(movie.title || movie.name);
  if (!tmdbMovie) return null;

  const providers = await getWatchProviders(tmdbMovie.id);

  return {
    id: tmdbMovie.id,
    title: tmdbMovie.title,
    overview: tmdbMovie.overview,
    poster: tmdbMovie.poster_path
      ? IMG + tmdbMovie.poster_path
      : null,
    rating: tmdbMovie.vote_average,
    release_date: tmdbMovie.release_date,
    providers,
  };
}

/* ---------------- AI RECOMMEND ---------------- */
app.post("/recommend", async (req, res) => {
  try {
    const aiResponse = await openai.responses.create({
      model: "gpt-4o-mini",
      input: `
Suggest 5 movies.
Return ONLY valid JSON array.
Each item:
- title
- overview

Request: ${req.body.prompt}
`,
    });

    const raw =
      aiResponse.output?.[0]?.content?.[0]?.text || "";

    const aiMovies = JSON.parse(
      raw.replace(/```json|```/g, "").trim()
    );

    const results = (
      await Promise.all(aiMovies.map(enrichMovie))
    ).filter(Boolean);

    res.json({ results });
  } catch (e) {
    console.error(e);
    res.status(500).json({ results: [] });
  }
});

/* ---------------- TRENDING ---------------- */
app.get("/trending", async (_, res) => {
  const data = await TMDB.get("/trending/movie/week");
  const results = await Promise.all(
    data.data.results.slice(0, 10).map(enrichMovie)
  );
  res.json(results.filter(Boolean));
});

/* ---------------- LATEST ---------------- */
app.get("/latest", async (_, res) => {
  const data = await TMDB.get("/movie/now_playing");
  const results = await Promise.all(
    data.data.results.slice(0, 10).map(enrichMovie)
  );
  res.json(results.filter(Boolean));
});

app.listen(process.env.PORT || 5000);
