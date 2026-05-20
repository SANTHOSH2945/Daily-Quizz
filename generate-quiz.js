const axios = require('axios');
const { GoogleGenAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');

async function generateQuiz() {
  try {
    // 1. Fetch current headlines (Using NewsAPI as an example)
    const newsUrl = `https://newsapi.org/v2/top-headlines?category=general&language=en&pageSize=8&apiKey=${process.env.NEWS_API_KEY}`;
    const newsResponse = await axios.get(newsUrl);
    
    const articles = newsResponse.data.articles || [];
    if (articles.length === 0) throw new Error("No news articles found today.");

    // Condense headlines for the AI prompt
    const contextText = articles.map((a, i) => `[${i+1}] ${a.title}: ${a.description || ''}`).join('\n');

    // 2. Initialize Gemini API
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const model = ai.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const systemPrompt = `
      You are an expert quiz master. Based strictly on the current affairs news headlines provided below, generate exactly 5 multiple-choice questions.
      
      Return ONLY a valid, raw JSON array matching this exact schema structural layout, with no markdown formatting, no code blocks, and no extra text:
      [
        {
          "id": 1,
          "question": "Clear, concise question string based on the news",
          "options": ["Option A", "Option B", "Option C", "Option D"],
          "correctAnswer": "The exact string matching the correct option"
        }
      ]

      News Context:
      ${contextText}
    `;

    // 3. Request AI response
    const aiResponse = await model.generateContent(systemPrompt);
    let rawText = aiResponse.response.text().trim();

    // Clean up rogue markdown backticks if the model accidentally returns them
    if (rawText.startsWith('```json')) {
      rawText = rawText.replace(/```json|```/g, '').trim();
    }

    // Validate that it's legitimate JSON before saving
    JSON.parse(rawText);

    // 4. Ensure data folder exists and save the file
    const dirPath = path.join(__dirname, 'data');
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath);
    }
    
    fs.writeFileSync(path.join(dirPath, 'today.json'), rawText, 'utf8');
    console.log("Daily quiz successfully updated in data/today.json!");

  } catch (error) {
    console.error("Critical Generation Failure:", error.message);
    process.exit(1); 
  }
}

generateQuiz();
