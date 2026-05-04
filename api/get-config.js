module.exports = (request, response) => {
  const config = {
    SUPABASE_URL: process.env.SUPABASE_URL || '',
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || ''
  };

  if (config.SUPABASE_URL && config.SUPABASE_ANON_KEY) {
    response.status(200).json(config);
  } else {
    response.status(404).json({ error: "Environment variables missing on Vercel." });
  }
};
