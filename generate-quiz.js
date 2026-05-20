const axios = require('axios');
const { GoogleGenAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');

async function generateQuiz() {
  try {
    // Fetch global news summaries via a free public RSS feed
    const parserUrl = 'https://api.rss2json.com/v1/api.json?rss_url=https://rss.nytimes.com/services/xml/rss/nyt/World.xml';
    const newsResponse = await axios.get(parserUrl);
    
    const articles = newsResponse.data.items || [];
    if (articles.length === 0) throw new Error("No news articles found today.");

    const contextText = articles.slice(0, 8).map((a, i) => `[${i+1}] ${a.title}: ${a.description || ''}`).join('\n');

    // Initialize Gemini API
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const model = ai.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const systemPrompt = `
      You are an expert quiz master. Based strictly on the news headlines provided below, generate exactly 5 multiple-choice questions.
      
      Return ONLY a valid, raw JSON array matching this exact schema layout, with no markdown formatting, no code blocks, and no extra text:
      [
        {
          "id": 1,
          "question": "Question string based on the news",
          "options": ["Option A", "Option B", "Option C", "Option D"],
          "correctAnswer": "The exact string matching the correct option"
        }
      ]

      News Context:
      ${contextText}
    `;

    const aiResponse = await model.generateContent(systemPrompt);
    let rawText = aiResponse.response.text().trim();

    // SAFETY FILTER: Strip out rogue markdown formatting backticks if Gemini adds them
    if (rawText.includes('```')) {
      rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    }

    // Double-check alignment formatting to make it clean
    JSON.parse(rawText);

    // Save the file cleanly into your data folder
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
