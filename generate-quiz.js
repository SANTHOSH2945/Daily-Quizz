const axios = require('axios');
const fs = require('fs');
const path = require('path');

async function generateQuiz() {
  try {
    // 1. Fetch news from the free public feed
    const parserUrl = 'https://api.rss2json.com/v1/api.json?rss_url=https://rss.nytimes.com/services/xml/rss/nyt/World.xml';
    const newsResponse = await axios.get(parserUrl);
    
    const articles = newsResponse.data.items || [];
    if (articles.length === 0) throw new Error("No news articles found today.");

    const contextText = articles.slice(0, 8).map((a, i) => `[${i+1}] ${a.title}: ${a.description || ''}`).join('\n');

    // 2. Build the master prompt
    const systemPrompt = `
      You are an expert quiz master. Based strictly on the news headlines provided below, generate exactly 5 multiple-choice questions.
      
      Return ONLY a valid, raw JSON array matching this exact schema layout with no code blocks, no markdown formatting, and no conversational text:
      [
        {
          "id": 1,
          "question": "Clear question text based on recent news",
          "options": ["Option A", "Option B", "Option C", "Option D"],
          "correctAnswer": "The exact option string that is correct"
        }
      ]

      News Context:
      ${contextText}
    `;

    // 3. UNIVERSAL STABLE ENDPOINT: This layout bypasses versioning glitches entirely
    const apiKey = process.env.GEMINI_API_KEY;
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const aiResponse = await axios.post(apiUrl, {
      contents: [{
        parts: [{
          text: systemPrompt
        }]
      }]
    });

    // Extract text safely using the core JSON tree format
    let rawText = aiResponse.data.candidates[0].content.parts[0].text.trim();

    // Clean up rogue markdown code blocks if the model appends them
    if (rawText.includes('```')) {
      rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    }

    // Validate structural integrity sanity check
    JSON.parse(rawText);

    // 4. Save directly into your tracking folder
    const dirPath = path.join(__dirname, 'data');
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath);
    }
    
    fs.writeFileSync(path.join(dirPath, 'today.json'), rawText, 'utf8');
    console.log("Daily quiz data successfully saved!");

  } catch (error) {
    console.error("Quiz Generator Error:", error.message);
    process.exit(1); 
  }
}

generateQuiz();
