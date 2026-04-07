import { GoogleGenerativeAI } from '@google/generative-ai';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido. Usa POST.' });
  }

  try {
    const { imageBase64 } = req.body;

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return res.status(400).json({ error: 'No se proporcionó una imagen válida en base64.' });
    }

    if (imageBase64.length > 5_000_000) {
      return res.status(413).json({ error: 'La imagen es demasiado grande. Reduce el tamaño antes de subirla.' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'Falta la API Key en el servidor.' });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash',
      generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `Actúa como experto en logística. Analiza este conduce y extrae la información técnica.
Estructura OBLIGATORIA (JSON puro):
{
  "suplidor": { "nombre": "" },
  "registro": { "fecha": "", "conduce_nro": "", "entregado_por": "" },
  "items": [ { "descripcion": "", "cantidad_impresa": 0, "unidad": "", "novedad_detectada": false } ]
}`;

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout IA')), 15000)
    );

    const callGemini = async () => {
      return await model.generateContent([
        prompt,
        { inlineData: { data: imageBase64, mimeType: 'image/jpeg' } },
      ]);
    };

    let result: any;

    // 🔥 MEJORA DIOS 3: Retry Automático
    try {
      result = await Promise.race([callGemini(), timeoutPromise]);
    } catch (err) {
      console.warn('Reintentando llamada a la IA tras fallo inicial...');
      result = await Promise.race([callGemini(), timeoutPromise]);
    }

    const responseText = result.response.text();

    let parsedData;
    try {
      parsedData = JSON.parse(responseText);
    } catch (parseError: any) {
      return res.status(502).json({ error: 'La IA devolvió un formato inválido.', details: parseError.message });
    }

    if (!parsedData.suplidor || !parsedData.registro || !Array.isArray(parsedData.items)) {
      return res.status(502).json({ error: 'La IA omitió datos requeridos.' });
    }

    // Normalizar Fechas
    const normalizeFecha = (fecha: string) => {
      if (!fecha) return new Date().toISOString();
      const parsed = new Date(fecha);
      return isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
    };
    parsedData.registro.fecha = normalizeFecha(parsedData.registro.fecha);

    // 🔥 MEJORA DIOS 1: Safe Parse Number
    const safeParseNumber = (value: any) => {
      if (typeof value === 'number') return value;
      if (typeof value === 'string') {
        const cleaned = value.replace(/[^\d.]/g, '');
        if (!cleaned) return null;
        const num = parseFloat(cleaned);
        return isNaN(num) ? null : num;
      }
      return null;
    };

    // 🔥 MEJORA DIOS 2: Normalización de Unidades
    const normalizeUnidad = (unidad: string) => {
      if (!unidad) return 'UND';
      const u = unidad.toLowerCase();
      if (u.includes('caja') || u.includes('cj')) return 'CAJA';
      if (u.includes('und') || u.includes('unidad')) return 'UND';
      if (u.includes('kg') || u.includes('kilo')) return 'KG';
      if (u.includes('lb') || u.includes('libra')) return 'LB';
      return unidad.toUpperCase();
    };

    const normalizeItem = (item: any) => ({
      ...item,
      cantidad_impresa: safeParseNumber(item.cantidad_impresa),
      unidad: normalizeUnidad(item.unidad)
    });

    const isValidItem = (item: any) => (
      typeof item.descripcion === 'string' &&
      item.cantidad_impresa !== null && 
      typeof item.unidad === 'string'
    );

    const validItems = parsedData.items.map(normalizeItem).filter(isValidItem);

    if (validItems.length === 0) {
      return res.status(502).json({ error: 'Los items devueltos no son válidos (ej. ruido o texto indescifrable en cantidades).' });
    }

    parsedData.items = validItems;

    return res.status(200).json(parsedData);

  } catch (error: any) {
    console.error('🔥 Error crítico en el servidor:', error);
    return res.status(500).json({ error: 'Error interno del servidor', details: error.message });
  }
}
