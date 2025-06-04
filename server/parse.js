import express from "express";
import multer from "multer";
import fs from "fs";
import sharp from "sharp";
import cors from "cors";
import dotenv from "dotenv";
import { OpenAI } from "openai";
import bodyParser from "body-parser";
import path from "path";

dotenv.config();

const app = express();

// Render asigna un puerto dinámico en process.env.PORT; en local, usa 3001
const PORT = process.env.PORT || 3001;

// Configuramos multer para subir imágenes a la carpeta "uploads"
const upload = multer({ dest: "uploads/" });

// Instanciamos el cliente de OpenAI con la apiKey desde .env
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Habilitamos CORS para que cualquier dominio (por ejemplo GitHub Pages) pueda llamar a este backend
app.use(cors());

// Parseo de JSON en las peticiones
app.use(express.json());
app.use(bodyParser.json());

// ------------------------------------------------------------------
// Función de ayuda para enviar errores con un mismo formato JSON
// ------------------------------------------------------------------
function sendFail(res, status, msg, err = null) {
  if (err) console.error("🚫", err);
  res.status(status).json({ error: msg });
}

// ------------------------------------------------------------------
// Endpoint: /parse
// Recibe un archivo (multipart/form-data), lo convierte a JPEG y envía a OpenAI
// ------------------------------------------------------------------
app.post("/parse", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return sendFail(res, 400, "Falta el archivo");
  }

  const tmpPath = req.file.path;          // Carpeta temporal de multer
  const originalName = req.file.originalname;
  const mime = req.file.mimetype;
  console.log(`→ /parse: ${originalName} (${mime})`);

  try {
    // Convertir a JPG con calidad 85%
    const jpgPath = `${tmpPath}.jpg`;
    await sharp(tmpPath).jpeg({ quality: 85 }).toFile(jpgPath);

    // Leer el JPG resultante como Base64
    const base64 = fs.readFileSync(jpgPath, { encoding: "base64" });
    const dataUri = `data:image/jpeg;base64,${base64}`;

    // Llamada a OpenAI con modelo gpt-4o-mini
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                `Extrae proveedor, fecha, subtotal, impuestos, total y partidas con descripción y monto.\n` +
                `Devuélvelo SOLO como JSON válido en la forma:\n` +
                `{ "proveedor": string, "fecha": string, "subtotal": number, "impuestos": number, "total": number, ` +
                `"partidas":[{ "descripcion": string, "monto": number }] }`
            },
            {
              type: "image_url",
              image_url: { url: dataUri }
            }
          ]
        }
      ]
    });

    // El modelo puede devolver el JSON dentro de un bloque ```json … ```
    const raw = completion.choices[0]?.message?.content ?? "{}";
    console.log("⤵️ Respuesta IA (raw):", raw);

    // Limpiamos cadenas de ```json…``` si las hubiera y parseamos
    const clean = raw.replace(/```json|```/gi, "").trim();
    const json = JSON.parse(clean);

    // Enviamos el JSON resultante al cliente
    res.json(json);
  } catch (err) {
    return sendFail(res, 500, "Falló la extracción", err);
  } finally {
    // Eliminamos archivos temporales
    fs.unlink(tmpPath, () => {});
    fs.unlink(`${tmpPath}.jpg`, () => {});
  }
});

// ------------------------------------------------------------------
// Endpoint: /chat (estilo asistente profesional)
// Recibe { message: string } y responde { reply: string }
// ------------------------------------------------------------------
const systemContext = `
Eres un asistente profesional del portafolio de Jeisson Ventura, un analista de datos y especialista en Power BI, 
automatización (RPA), inteligencia artificial y ciencia de datos aplicada a la banca y finanzas.
Jeisson ha trabajado con herramientas como Power BI, Power Query, SQL Server, Python, RStudio, SSIS y Power Automate.

Proyectos destacados:
- Automatización de envíos con Power Automate
- Dashboards financieros y operativos con Power BI
- Aplicaciones con IA para extracción de facturas
- Segmentación de rutas usando algoritmos en R
- App móvil para control de personal con reconocimiento facial

Certificaciones:
- Especialista en IA aplicada a procesos automatizados
- Especialista en ciencia de datos aplicada a banca y finanzas
- Certificado en SQL Server, Microsoft Excel, Python y RStudio

No compartas datos sensibles como teléfono o correo. Si el usuario desea contactarte, dile que puede hacerlo desde los íconos de WhatsApp, Gmail o Outlook disponibles en el portafolio.
`;

app.post("/chat", async (req, res) => {
  const { message } = req.body;
  if (!message || message.length < 3) {
    return sendFail(res, 400, "Mensaje inválido o vacío");
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 500,
      messages: [
        { role: "system", content: systemContext },
        { role: "user", content: message }
      ]
    });

    const reply =
      completion.choices[0]?.message?.content ||
      "Lo siento, no pude responder esa consulta.";
    res.json({ reply });
  } catch (err) {
    return sendFail(res, 500, "Error al procesar el mensaje", err);
  }
});

// ------------------------------------------------------------------
// Endpoint: /bitbit-chat (estilo asistente amigable visual)
// Recibe { question: string } y responde { answer: string }
// ------------------------------------------------------------------
app.post("/bitbit-chat", async (req, res) => {
  const { question } = req.body;
  if (!question || question.length < 3) {
    return sendFail(res, 400, "Pregunta inválida o vacía");
  }

  const systemMessage = `
Eres BitBit, un asistente visual con estilo amigable y moderno. Respondes preguntas sobre Jeisson Ventura.
Resumen del perfil de Jeisson:
- Especialista en Ciencia de Datos aplicados a banca y finanzas
- Certificado en IA para automatización de procesos
- Experto en Power BI, RStudio, Python, SQL Server y Excel avanzado
- Implementó dashboards comerciales, operativos y de KPIs
- Automatizó procesos ETL y RPA con SSIS, Power Automate y R
- Desarrolló apps para análisis de rutas, predicción de fraude y clustering

No menciones a OpenAI ni que eres un modelo de lenguaje. Sé directo, claro y natural.
  `;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 400,
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: question }
      ]
    });

    const answer =
      completion.choices[0]?.message?.content?.trim() ||
      "Hubo un problema con la respuesta.";
    res.json({ answer });
  } catch (error) {
    console.error("❌ Error en BitBit Chat:", error.message);
    res.status(500).json({
      answer: "Lo siento, hubo un problema al procesar la respuesta."
    });
  }
});

// ------------------------------------------------------------------
// Iniciar el servidor en el puerto dinámico (o 3001 en local)
// ------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`🟢  IA-Extractor backend listo → http://localhost:${PORT}`);
});
