const axios = require('axios');
const fs = require('fs');

// 1. Fetch environment variables from GitHub Actions
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const quizCategories = process.env.QUIZ_CATEGORIES || "Telangana, India";
const mechSections = process.env.MECH_EXAM_SECTIONS || "Mechanical Engineering";
const mechTimeLimit = parseInt(process.env.MECH_TIME_LIMIT_SECONDS || "60", 10);

async function generateQuiz() {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`;

  // 2. Build a system prompt that enforces diversity and injects the engineering topics
  const systemPrompt = `
    You are a professional quiz generator for competitive exams like TSPSC, UPSC, and Engineering Services (GATE/ESE).
    
    Generate a JSON array of 15 unique multiple-choice questions based strictly on these two components:
    
    Component 1: General Awareness & Current Affairs
    - Target Areas: ${quizCategories}
    - Instruction: Do not focus only on the single biggest news event. Diversify across history, geography, regional governance schemes, and economy.
    
    Component 2: Technical Engineering Core
    - Target Areas: ${mechSections}
    - Instruction: Provide conceptual and numerical questions suitable for competitive exams.
    
    Return ONLY a raw JSON array following this exact schema structure:
    [
      {
        "id": "q1",
        "category": "Telangana History",
        "question": "...",
        "options": ["A", "B", "C", "D"],
        "correct_answer": "...",
        "time_limit_seconds": null
      },
      {
        "id": "q11",
        "category": "Mechanical Engineering",
        "question": "...",
        "options": ["A", "B", "C", "D"],
        "correct_answer": "...",
        "time_limit_seconds": ${mechTimeLimit}
      }
    ]
  `;

  try {
    const response = await axios.post(url, {
      contents: [{ parts: [{ text: systemPrompt }] }]
    });

    // 3. Extract and parse the text content
    let rawText = response.data.candidates[0].content.parts[0].text;
    
    // Clean up markdown block wraps if the model includes them
    rawText = rawText.replace(/```json|```/g, '').trim();
    
    const quizData = JSON.parse(rawText);

    // 4. (Optional) Fail-safe: Ensure time limits are explicitly set for Mechanical questions
    quizData.forEach(question => {
      if (question.category.toLowerCase().includes('mechanical') || question.category.toLowerCase().includes('engineering')) {
        question.time_limit_seconds = mechTimeLimit;
      } else {
        question.time_limit_seconds = null; // Or a default time for general current affairs (e.g., 30)
      }
    });

    // 5. Save the updated data back for Vercel deployment
    fs.writeFileSync('data/today.json', JSON.stringify(quizData, null, 2));
    console.log("Quiz data successfully updated in data/today.json");

  } catch (error) {
    console.error("Error generating quiz:", error.message);
    process.exit(1);
  }
}

generateQuiz();
