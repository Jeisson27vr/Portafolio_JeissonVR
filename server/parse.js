import express from "express";
import multer from "multer";
import fs from "fs";
import sharp from "sharp";
import cors from "cors";
import dotenv from "dotenv";
import { OpenAI } from "openai";
import bodyParser from "body-parser";

dotenv.config(); // Carga variables de .env para desarrollo local

// Puerto del servidor: Render asignará un puerto dinámicamente a través de process.env.PORT
// Localmente, si process.env.PORT no está definido, usará 3001.
const PORT = process.env.PORT || 3001;

const upload = multer({ dest: "uploads/" }); // Directorio para subidas temporales
const app = express();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY }); // Lee la API Key desde variables de entorno

// --- Configuración de CORS más específica ---
// ¡¡¡ACCIÓN CRÍTICA: DEBES ACTUALIZAR ESTA LISTA!!!
// Reemplaza 'https://TU_USUARIO.github.io' con la URL EXACTA de tu portafolio en GitHub Pages.
// Añade también los localhosts que uses para desarrollo del frontend si es necesario.
const allowedOrigins = [
    'https://TU_USUARIO.github.io', // EJEMPLO: 'https://jeissonventura.github.io' (CAMBIA ESTO)
    'http://localhost:5500',        // Ejemplo si usas Live Server en este puerto para tu frontend
    'http://127.0.0.1:5500',       // Otra forma de referirse a localhost
    // 'http://localhost:TU_PUERTO_FRONTEND' // Si tu frontend corre en otro puerto local
];

const corsOptions = {
    origin: function (origin, callback) {
        // Permitir solicitudes sin 'origin' (como Postman, apps móviles) O si el origen está en la lista blanca
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.warn(`Acceso denegado por CORS desde el origen: ${origin}`); // Loguea el origen bloqueado
            callback(new Error(`El acceso desde el origen ${origin} no está permitido por CORS.`));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // Métodos HTTP permitidos
    allowedHeaders: ['Content-Type', 'Authorization'],   // Cabeceras permitidas en las solicitudes
    credentials: true // Si necesitas enviar cookies o cabeceras de autorización
};

app.use(cors(corsOptions)); // Aplicar la configuración de CORS

// Middleware para parsear JSON, con límite aumentado para imágenes en base64
app.use(express.json({ limit: '10mb' }));
app.use(bodyParser.json({ limit: '10mb' })); // bodyParser también es común, redundancia no daña aquí

// Función para enviar errores estándar y consistentes
function sendFail(res, status, msg, err = null) {
  if (err) {
    // Para errores de OpenAI, a veces el mensaje útil está en err.error.message o err.message
    const errorMessage = err.error?.message || err.message || 'Detalles del error no disponibles.';
    console.error(`🚫 Error ${status}: ${msg} - Detalle: ${errorMessage}`, err.stack || err);
  } else {
    console.error(`🚫 Error ${status}: ${msg}`);
  }
  res.status(status).json({ error: msg });
}

/* ======== Endpoint /parse: Extracción de datos de facturas (imágenes) ======== */
app.post("/parse", upload.single("file"), async (req, res) => {
  if (!req.file) return sendFail(res, 400, "Falta el archivo para procesar.");

  const tmpPath = req.file.path;
  const mime = req.file.mimetype;
  console.log(`→ Petición a /parse: ${req.file.originalname} (${mime})`);
  const jpgPath = `${tmpPath}.jpg`; // Definir jpgPath aquí para usarlo en el bloque finally

  try {
    // Convertir la imagen a JPEG (OpenAI funciona bien con JPEG y PNG)
    await sharp(tmpPath).jpeg({ quality: 85 }).toFile(jpgPath);

    // Leer el archivo JPEG convertido y codificarlo en base64
    const base64Image = fs.readFileSync(jpgPath, { encoding: "base64" });
    const dataUri = `data:image/jpeg;base64,${base64Image}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // o gpt-4o para mejor calidad si el presupuesto lo permite
      max_tokens: 700, // Ajustar si la respuesta JSON es muy larga
      // response_format: { type: "json_object" }, // Para modelos más nuevos, esto puede ayudar a forzar JSON
      messages: [{
        role: "user",
        content: [
          {
            type: "text",
            text: `Extrae la siguiente información de la imagen de la factura: proveedor (nombre de la empresa emisora), fecha (en formato YYYY-MM-DD), subtotal (valor numérico antes de impuestos), impuestos (valor numérico total de impuestos), total (valor numérico final).
Adicionalmente, extrae las partidas o ítems de la factura, donde cada partida debe tener 'descripcion' (el nombre o descripción del producto/servicio) y 'monto' (el valor numérico de esa partida).
Devuelve la información ÚNICAMENTE como un objeto JSON válido con la siguiente estructura exacta:
{ "proveedor": "string", "fecha": "YYYY-MM-DD", "subtotal": number, "impuestos": number, "total": number, "partidas":[{"descripcion":"string","monto":number}] }
Si algún campo no se puede extraer, usa null para strings o 0 para números, pero mantén la estructura JSON.`
          },
          { type: "image_url", image_url: { url: dataUri } }
        ]
      }]
    });

    let rawResponse = completion.choices[0]?.message?.content;
    if (!rawResponse) {
        return sendFail(res, 500, "Respuesta vacía de la IA.");
    }

    console.log("⤵️ Respuesta cruda de IA para /parse:", rawResponse);

    // Limpieza robusta de la respuesta JSON (manejo de ```json y espacios)
    const cleanedResponse = rawResponse.replace(/```json\s*|\s*```/g, "").trim();

    let jsonOutput;
    try {
        jsonOutput = JSON.parse(cleanedResponse);
    } catch (parseError) {
        console.error("Error al parsear JSON de la IA:", parseError, "Respuesta original:", cleanedResponse);
        return sendFail(res, 500, "Falló la extracción de datos: formato de respuesta IA inválido.", parseError);
    }

    res.json(jsonOutput);

  } catch (err) {
    sendFail(res, 500, "Falló la extracción de datos de la factura.", err);
  } finally {
    // Limpieza de archivos temporales
    if (fs.existsSync(tmpPath)) {
        fs.unlink(tmpPath, (unlinkErr) => {
            if (unlinkErr) console.error("Error eliminando archivo temporal original:", tmpPath, unlinkErr);
        });
    }
    if (fs.existsSync(jpgPath)) {
        fs.unlink(jpgPath, (unlinkErr) => {
            if (unlinkErr) console.error("Error eliminando archivo JPG temporal:", jpgPath, unlinkErr);
        });
    }
  }
});

/* ======== Endpoint /chat: Asistente profesional del portafolio ======== */
const systemContextPortfolio = `
Eres un asistente virtual altamente profesional y servicial, especializado en el perfil y portafolio de Jeisson Ventura.
Jeisson Ventura es un destacado Analista de Datos y especialista en Power BI, Automatización de Procesos Robóticos (RPA), Inteligencia Artificial y Ciencia de Datos, con una fuerte aplicación en el sector de banca y finanzas.
Dominio técnico: Power BI, Power Query, SQL Server, Python (Pandas, Scikit-learn), RStudio, SSIS (SQL Server Integration Services) y Power Automate.

Proyectos Relevantes de Jeisson:
- Automatización de procesos de envío y reportería mediante Power Automate.
- Desarrollo de dashboards financieros, comerciales y operativos de alto impacto utilizando Power BI.
- Creación de aplicaciones con Inteligencia Artificial para la extracción automática de datos de facturas.
- Implementación de algoritmos de segmentación y optimización de rutas logísticas en R.
- Desarrollo de una aplicación móvil para control de personal con tecnología de reconocimiento facial.

Certificaciones Clave:
- Especialista en Inteligencia Artificial aplicada a la automatización de procesos.
- Especialista en Ciencia de Datos aplicada al sector de Banca y Finanzas.
- Certificaciones en SQL Server, Microsoft Excel Avanzado, Python para Ciencia de Datos y RStudio.

Tu principal objetivo es proporcionar información clara, concisa y precisa sobre la experiencia, habilidades y proyectos de Jeisson.
ABSOLUTAMENTE PROHIBIDO compartir datos de contacto personales como número de teléfono o dirección de correo electrónico.
Si un usuario solicita explícitamente contactar a Jeisson, indícale amablemente que puede utilizar los íconos de contacto (WhatsApp, Gmail, Outlook, LinkedIn) que se encuentran visibles en el portafolio web para iniciar una conversación directa.
Mantén un tono formal, pero accesible. Evita especulaciones o información no contenida en este contexto.
Si no conoces una respuesta o la pregunta se desvía del perfil de Jeisson, indica cortésmente que no puedes proporcionar esa información.
`;

app.post("/chat", async (req, res) => {
  const { message } = req.body;
  if (!message || typeof message !== 'string' || message.trim().length < 3) {
    return sendFail(res, 400, "El mensaje es inválido, vacío o demasiado corto.");
  }
  console.log(`→ Petición a /chat: "${message}"`);

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // o gpt-4o
      max_tokens: 500, // Ajustar según necesidad
      temperature: 0.7, // Un poco de creatividad pero manteniendo la profesionalidad
      messages: [
        { role: "system", content: systemContextPortfolio },
        { role: "user", content: message.trim() }
      ]
    });

    const reply = completion.choices[0]?.message?.content?.trim() || "Lo siento, no pude generar una respuesta en este momento.";
    console.log("⤵️ Respuesta IA para /chat:", reply);
    res.json({ reply });

  } catch (err) {
    sendFail(res, 500, "Error al procesar tu mensaje con el asistente.", err);
  }
});

/* ======== Endpoint /bitbit-chat: Asistente visual BitBit (estilo amigable) ======== */
const systemContextBitBit = `
¡Hola! Soy BitBit, tu amigable asistente visual aquí para contarte todo sobre Jeisson Ventura con un toque moderno y divertido.
Perfil de Jeisson en corto:
- Un crack en Ciencia de Datos, ¡especialmente para banca y finanzas!
- Certificado en IA para hacer que los procesos ¡vuelen! (automatización).
- Maestro de herramientas como Power BI, RStudio, Python, SQL Server y Excel avanzado.
- Ha creado dashboards súper visuales para negocios, operaciones y KPIs.
- ¡Automatizador estrella! Ha puesto en marcha procesos ETL y RPA con SSIS, Power Automate y R.
- ¡Desarrollador ingenioso! Creó apps para cosas geniales como análisis de rutas, predicción de fraude y clustering de clientes.
Mi misión es ser súper directo, claro y natural. ¡Nada de rollos técnicos aburridos ni mencionar que soy un modelo de lenguaje o algo de OpenAI!
Si quieres contactar a Jeisson, ¡facilísimo! Dile que use los iconitos de WhatsApp, email, etc., que ve en el portafolio.
`;

app.post("/bitbit-chat", async (req, res) => {
  const { question } = req.body;
  if (!question || typeof question !== 'string' || question.trim().length < 3) {
    return sendFail(res, 400, "La pregunta para BitBit es inválida, vacía o demasiado corta.");
  }
  console.log(`→ Petición a /bitbit-chat: "${question}"`);

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // o gpt-4o
      max_tokens: 400,
      temperature: 0.8, // Un poco más de creatividad para BitBit
      messages: [
        { role: "system", content: systemContextBitBit },
        { role: "user", content: question.trim() }
      ]
    });

    const answer = completion.choices[0]?.message?.content?.trim() || "¡Uy! Parece que me quedé sin palabras por un momento. Intenta de nuevo.";
    console.log("⤵️ Respuesta IA para /bitbit-chat:", answer);
    res.json({ answer });

  } catch (err) {
    sendFail(res, 500, "BitBit tuvo un pequeño problema para procesar tu pregunta.", err);
  }
});


/* ======== Endpoint de prueba (Opcional pero útil) ======== */
app.get("/", (req, res) => {
    res.status(200).json({
        message: "¡El backend del portafolio de Jeisson Ventura está funcionando!",
        status: "OK",
        timestamp: new Date().toISOString(),
        instructions: "Puedes probar los endpoints POST /chat, /bitbit-chat, o /parse."
    });
});


/* ======== Iniciar servidor ======== */
app.listen(PORT, '0.0.0.0', () => // Escuchar en 0.0.0.0 es importante para Render
  console.log(`🟢 Backend IA del portafolio de Jeisson Ventura listo y escuchando en http://0.0.0.0:${PORT}`)
);
