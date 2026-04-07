// api/process-document.ts
import { GoogleGenerativeAI } from '@google/generative-ai';

export default async function handler(req: any, res: any) {
  // Solo permitimos peticiones POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { imageBase64 } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'No image provided' });
    }

    // Inicializamos Gemini de forma segura (la llave vive en Vercel, no en el cliente)
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `Actúa como un experto en logística. Analiza la imagen de este conduce y extrae la información técnica en JSON puro.
Estructura OBLIGATORIA:
{
  "suplidor": { "nombre": "" },
  "registro": { "fecha": "", "conduce_nro": "", "entregado_por": "" },
  "items": [ { "descripcion": "", "cantidad_impresa": 0, "unidad": "", "novedad_detectada": false } ]
}`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: imageBase64,
          mimeType: 'image/jpeg',
        },
      },
    ]);

    const responseText = result.response.text();

    // 🛡️ LIMPIEZA ROBUSTA DEL JSON: Quitamos bloques markdown de la IA
    const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    
    const parsedData = JSON.parse(cleanJson);

    return res.status(200).json(parsedData);
  } catch (error) {
    console.error('Error en API Route:', error);
    return res.status(500).json({ error: 'Failed to process document with AI' });
  }
}
