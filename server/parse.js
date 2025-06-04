import express from "express";
import multer from "multer";
import fs from "fs";
import sharp from "sharp";
import cors from "cors";
import dotenv from "dotenv";
import { OpenAI } from "openai";
import bodyParser from "body-parser";

dotenv.config();

const PORT = 3001;
const upload = multer({ dest: "uploads/" });
const app = express();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(cors());
app.use(express.json());
app.use(bodyParser.json());

// Función para enviar errores estándar
function sendFail(res, status, msg, err = null) {
  if (err) console.error("🚫", err);
  res.status(status).json({ error: msg });
}

/* ======== Endpoint /parse ======== */
app.post("/parse", upload.single("file"), async (req, res) => {
  if (!req.file) return sendFail(res, 400, "Falta el archivo");

  const tmpPath = req.file.path;
  const mime = req.file.mimetype;
  console.log(`→ /parse: ${req.file.originalname} ${mime}`);

  try {
    const jpgPath = `${tmpPath}.jpg`;
    await sharp(tmpPath).jpeg({ quality: 85 }).toFile(jpgPath);
    const base64 = fs.readFileSync(jpgPath, { encoding: "base64" });
    const dataUri = `data:image/jpeg;base64,${base64}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 500,
      messages: [{
        role: "user",
        content: [
          {
            type: "text",
            text: `Extrae proveedor, fecha, subtotal, impuestos, total y partidas con descripción y monto.
Devuélvelo SOLO como JSON válido en la forma:
{ proveedor, fecha, subtotal, impuestos, total, partidas:[{descripcion,monto}] }`
          },
          { type: "image_url", image_url: { url: dataUri } }
        ]
      }]
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    console.log("⤵️ Respuesta IA:", raw);
    const clean = raw.replace(/```json|```/gi, "").trim();
    const json = JSON.parse(clean);

    res.json(json);
  } catch (err) {
    sendFail(res, 500, "Falló la extracción", err);
  } finally {
    fs.unlink(tmpPath, () => {});
    fs.unlink(`${tmpPath}.jpg`, () => {});
  }
});

/* ======== Endpoint /chat: estilo asistente profesional ======== */
const systemContext = `
Eres un asistente profesional del portafolio de Jeisson Ventura, un analista de datos y especialista en Power BI, automatización (RPA), inteligencia artificial y ciencia de datos aplicada a la banca y finanzas.
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

    const reply = completion.choices[0]?.message?.content || "Lo siento, no pude responder esa consulta.";
    res.json({ reply });
  } catch (err) {
    sendFail(res, 500, "Error al procesar el mensaje", err);
  }
});

/* ======== Endpoint /bitbit-chat: estilo amigable visual ======== */
app.post("/bitbit-chat", async (req, res) => {
  try {
    const { question } = req.body;

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

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 400,
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: question }
      ]
    });

    const answer = completion.choices[0]?.message?.content?.trim() || "Hubo un problema con la respuesta.";
    res.json({ answer });

  } catch (error) {
    console.error("❌ Error en BitBit Chat:", error.message);
    res.status(500).json({ answer: "Lo siento, hubo un problema al procesar la respuesta." });
  }
});

/* ======== Iniciar servidor ======== */
app.listen(PORT, () =>
  console.log(`🟢  IA-Extractor backend listo → http://localhost:${PORT}`)
);
