import { GoogleGenAI } from "@google/genai";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const generateProductDescription = async (name: string, category: string): Promise<string> => {
  if (!process.env.API_KEY) {
    return "Descripción no disponible (API Key faltante).";
  }

  try {
    const prompt = `Escribe una descripción corta, apetitosa y atractiva para un menú de restaurante. 
    Producto: ${name}
    Categoría: ${category}
    Idioma: Español
    Máximo 20 palabras.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text?.trim() || "Deliciosa opción de la casa.";
  } catch (error) {
    console.error("Error generating description:", error);
    return "Una excelente elección para tu paladar.";
  }
};