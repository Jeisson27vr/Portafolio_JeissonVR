// js/ia.js

// 1) Definimos la URL pública de tu backend en Render
const BACKEND_URL = "https://portafolio-jeissonvr-backend.onrender.com";

// 2) Tomamos referencias a los elementos del chat
const chatBody  = document.getElementById("chatBody");
const chatInput = document.getElementById("chatInput");
const sendBtn   = document.getElementById("sendBtn");

// 3) Registramos los listeners NECESARIOS para “Enviar”
sendBtn.addEventListener("click", enviarPregunta);
chatInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    e.preventDefault(); // evitamos que se inserte un salto de línea
    enviarPregunta();
  }
});

// 4) Función principal que se encarga de mostrar el mensaje,
//    llamar al backend y mostrar la respuesta
async function enviarPregunta() {
  const pregunta = chatInput.value.trim();
  if (!pregunta) {
    console.log("EnviarPregunta(): campo vacío, no hay nada que enviar.");
    return;
  }

  console.log("EnviarPregunta(): se va a enviar la pregunta ->", pregunta);

  // Mostrar el mensaje del usuario en pantalla
  chatBody.innerHTML += `<div class="msg user">${pregunta}</div>`;

  // Mostrar mensaje temporal “Pensando…”
  chatBody.innerHTML += `<div class="msg bot">⏳ Pensando…</div>`;

  // Limpiar input y desplazarnos al final
  chatInput.value = "";
  chatBody.scrollTop = chatBody.scrollHeight;

  try {
    // 5) Llamada al backend en Render (¡IMPORTANTE: ya no usa localhost!)
    const resp = await fetch(`${BACKEND_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: pregunta })
    });

    console.log("EnviarPregunta(): respuesta recibida, status:", resp.status);

    // Intentamos parsear el JSON (aunque no sea ok, igual parseamos para ver error.error)
    const data = await resp.json().catch((err) => {
      console.error("Error al parsear JSON de la respuesta:", err);
      return null;
    });

    if (!resp.ok) {
      // Si el status no es 200-299, lanzamos excepción para que entre en catch
      const msgErr = data && data.error ? data.error : `Error ${resp.status}`;
      throw new Error(msgErr);
    }

    // 6) Reemplazar el “Pensando…” por la respuesta real
    chatBody.lastElementChild.remove();
    console.log("EnviarPregunta(): contenido de data.reply ->", data.reply);
    chatBody.innerHTML += `<div class="msg bot">${data.reply}</div>`;
  } catch (err) {
    // Si algo falla, quitamos la línea “Pensando…” y mostramos un mensaje de error
    console.error("EnviarPregunta() catch:", err);
    chatBody.lastElementChild.remove();
    chatBody.innerHTML += `<div class="msg bot">❌ Error al contactar al asistente.</div>`;
  }

  // Siempre volvemos a desplazarnos al final
  chatBody.scrollTop = chatBody.scrollHeight;
}
