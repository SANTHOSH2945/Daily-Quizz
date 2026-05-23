const axios = require('axios');
const fs = require('fs');
const path = require('path');

async function generateQuiz() {
  try {
    // 1. Fetch current regional/national news highlights from an Indian news source RSS feed
    // Modified to use Times of India - India National News RSS
    const parserUrl = 'https://api.rss2json.com/v1/api.json?rss_url=https://timesofindia.indiatimes.com/rssfeeds/-2128936835.cms';
    const newsResponse = await axios.get(parserUrl);

    const articles = newsResponse.data.items || [];
    if (articles.length === 0) throw new Error("No news articles found today.");

    // Intake up to 30 articles to analyze for regional contexts
    const contextText = articles.slice(0, 30).map((a, i) => `[${i+1}] ${a.title}: ${a.description || ''}`).join('\n');

    // 2. Build the structural quizmaster layout prompt with regional constraints
    // Modified instructions to strictly target India, Telangana, and Andhra Pradesh
    const systemPrompt = `
      You are an expert quiz master specializing in regional Indian current affairs. 
      Based on the news headlines provided below, generate exactly 25 distinct multiple-choice questions. 
      
      CRITICAL CONSTRAINT: You must ONLY generate questions that focus on or relate directly to India, with a strong prioritization and emphasis on the states of Telangana and Andhra Pradesh. Filter out any topics that have no relevance to these specific regions.
      
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

    // 3. Native Request Endpoint
    const apiKey = process.env.GEMINI_API_KEY;
    const apiUrl = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const aiResponse = await axios.post(apiUrl, {
      contents: [
        {
          parts: [
            { text: systemPrompt }
          ]
        }
      ]
    });

    if (!aiResponse.data.candidates || !aiResponse.data.candidates[0].content) {
      throw new Error("Empty or invalid object branch structure returned from Gemini API.");
    }

    let rawText = aiResponse.data.candidates[0].content.parts[0].text.trim();

    // Safety Filter: Strip out code block tags if the engine appends markdown wrappers
    if (rawText.includes('```')) {
      rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    }

    // Verify valid JSON structural alignment
    JSON.parse(rawText);

    // 4. Save the generated quiz array to the tracking repository folder
    const dirPath = path.join(__dirname, 'data');
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath);
    }

    fs.writeFileSync(path.join(dirPath, 'today.json'), rawText, 'utf8');
    console.log("Daily quiz data successfully saved to data/today.json with 25 regional questions!");

  } catch (error) {
    console.error("Quiz Generator Error:", error.message);
    if (error.response && error.response.data) {
      console.error("API Error Log Details:", JSON.stringify(error.response.data));
    }
    process.exit(1);
  }
}

generateQuiz();
