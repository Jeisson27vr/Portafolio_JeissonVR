// Definimos la URL pública de tu backend en Render
const BACKEND_URL = "https://portafolio-jeissonvr-backend.onrender.com";

const form    = document.getElementById("invoiceForm");
const fileIn  = document.getElementById("invoiceFile");
const spinner = document.getElementById("iaSpinner");
const result  = document.getElementById("iaResult");
const table   = document.getElementById("iaTable");
const chartEl = document.getElementById("iaChart");
const reco    = document.getElementById("iaReco");
const pdfBtn  = document.getElementById("pdfBtn");

let chartInstance;

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!fileIn.files.length) return alert("Selecciona una factura");

  spinner.hidden = false;
  result.hidden = true;
  reco.style.display = "none";
  pdfBtn.hidden = true;

  const fd = new FormData();
  fd.append("file", fileIn.files[0]);

  let data;
  try {
    // Cambiamos localhost por BACKEND_URL
    const resp = await fetch(`${BACKEND_URL}/parse`, {
      method: "POST",
      body: fd
    });
    data = await resp.json();
    if (!resp.ok) throw new Error(data.error || `Error ${resp.status}`);
  } catch (err) {
    spinner.hidden = true;
    alert(err.message || "Falló la extracción");
    return;
  }

  renderFactura(data);
  spinner.hidden = true;
  pdfBtn.hidden = false;
});

function renderFactura(d) {
  // Tabla resumen
  table.innerHTML = `
    <h3>${d.proveedor}</h3>
    <p><strong>Fecha:</strong> ${d.fecha}</p>
    <p><strong>Subtotal:</strong> $${d.subtotal.toFixed(2)}</p>
    <p><strong>Impuestos:</strong> $${d.impuestos.toFixed(2)}</p>
    <p><strong>Total:</strong> $${d.total.toFixed(2)}</p>
    <h4 style="margin-top:1rem">Partidas</h4>
    <table>
      <thead><tr><th>Descripción</th><th>Monto</th></tr></thead>
      <tbody>
        ${d.partidas.map(p => `<tr><td>${p.descripcion}</td><td>$${p.monto.toFixed(2)}</td></tr>`).join("")}
      </tbody>
    </table>
  `;

  // Gráfico
  if (chartInstance) chartInstance.destroy();
  const ctx = chartEl.getContext("2d");
  const grad = ctx.createLinearGradient(0, 0, 0, 260);
  grad.addColorStop(0, "#00ffa3");
  grad.addColorStop(1, "#006f46");

  chartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: d.partidas.map(p => p.descripcion),
      datasets: [{
        data: d.partidas.map(p => p.monto),
        backgroundColor: grad,
        borderColor: "#00ffa3",
        borderWidth: 1,
        borderRadius: 6
      }]
    },
    options: {
      animation: { duration: 1200, easing: "easeOutBounce" },
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: "#00ffa3", maxRotation: 45, minRotation: 45 }, grid: { display: false } },
        y: { ticks: { color: "#00ffa3" }, beginAtZero: true, grid: { color: "rgba(0,255,163,0.2)" } }
      }
    }
  });

  // Recomendación
  const mayor = d.partidas.reduce((a,b) => b.monto > a.monto ? b : a, d.partidas[0]);
  reco.innerHTML = `
    <strong>Recomendación:</strong><br/>
    Observamos que el mayor gasto fue en "<em>${mayor.descripcion}</em>" con un monto de $${mayor.monto.toFixed(2)}.
    Considera optimizar este rubro en tus próximos pedidos para reducir costos.
  `;
  reco.style.display = "block";
  result.hidden = false;
}

// PDF
pdfBtn.addEventListener("click", () => {
  html2pdf().set({
    filename: "resumen-factura.pdf",
    margin: 10,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: { scale: 2, backgroundColor: null },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
  }).from(result).save();
});

function toggleBitChat() {
  const box = document.getElementById('bitbit-chatbox');
  box.style.display = box.style.display === 'flex' ? 'none' : 'flex';
}

function handleBitbitKey(event) {
  if (event.key === 'Enter') {
    const input = document.getElementById('bitbitInput');
    const question = input.value.trim();
    if (!question) return;

    // Mostrar en UI
    const chatBody = document.getElementById('chatBody');
    const userMsg = document.createElement('div');
    userMsg.className = 'msg user';
    userMsg.innerText = question;
    chatBody.appendChild(userMsg);
    input.value = "";

    // Llamar a tu backend en Render en lugar de localhost
    fetch(`${BACKEND_URL}/bitbit-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question })
    })
    .then(res => res.json())
    .then(data => {
      const botMsg = document.createElement('div');
      botMsg.className = 'msg bot';
      botMsg.innerText = data.answer;
      chatBody.appendChild(botMsg);
      chatBody.scrollTop = chatBody.scrollHeight;
    })
    .catch(() => {
      const errorMsg = document.createElement('div');
      errorMsg.className = 'msg bot';
      errorMsg.innerText = "Ups, hubo un problema procesando tu pregunta.";
      chatBody.appendChild(errorMsg);
    });
  }
}
