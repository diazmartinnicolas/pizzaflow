import { GoogleGenAI } from "@google/genai";

// Initialize Gemini Client
const ai = new GoogleGenAI(import.meta.env.VITE_GEMINI_API_KEY || process.env.API_KEY || '');

export const generateProductDescription = async (name: string, category: string): Promise<string> => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) {
    return "Descripción no disponible (API Key faltante).";
  }

  try {
    const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `Escribe una descripción corta, apetitosa y atractiva para un menú de restaurante. 
    Producto: ${name}
    Categoría: ${category}
    Idioma: Español
    Máximo 20 palabras.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text().trim() || "Deliciosa opción de la casa.";
  } catch (error) {
    console.error("Error generating description:", error);
    return "Una excelente elección para tu paladar.";
  }
};