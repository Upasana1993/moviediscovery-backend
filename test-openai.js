const OpenAI = require("openai");
require("dotenv").config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

(async () => {
  try {
    const response = await openai.responses.create({
      model: "gpt-4o-mini",
      input: "Say hello in one short sentence.",
    });

    console.log("SUCCESS:");
    console.log(response.output_text);
  } catch (err) {
    console.error("FAIL:", err.message);
  }
})();
