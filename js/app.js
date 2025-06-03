// Mostrar contenido tras el loader
window.addEventListener("load", () => {
  const loader = document.getElementById("loader");
  setTimeout(() => {
    loader.style.opacity = 0;
    loader.style.transition = "opacity 0.5s ease";
    setTimeout(() => {
      loader.style.display = "none";
      const container = document.querySelector(".container");
      container.style.display = "block";
      container.style.opacity = 1;
      activarFadeIn();
      reproducirSonidoInicio();
    }, 500);
  }, 1500);
});

// Sonido en hover para botones
const hoverSound = new Audio("https://cdn.pixabay.com/download/audio/2022/03/15/audio_471d0c1ccf.mp3?filename=click-melodic-110624.mp3");
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".btn").forEach(btn => {
    btn.addEventListener("mouseenter", () => {
      hoverSound.currentTime = 0;
      hoverSound.play();
    });
  });
});

// Sonido al iniciar la interfaz
function reproducirSonidoInicio() {
  const initSound = new Audio("https://cdn.pixabay.com/download/audio/2022/03/03/audio_3505a6dbe3.mp3?filename=soft-notification-136512.mp3");
  initSound.volume = 0.5;
  initSound.play();
}

// Activar animaciones .fade-in
function activarFadeIn() {
  document.querySelectorAll("section, header").forEach(el => {
    el.classList.add("fade-in");
  });
}

// Formulario con mensaje de gracias
function mostrarGracias(e) {
  e.preventDefault();
  const form = e.target;
  const data = new FormData(form);
  fetch(form.action, {
    method: "POST",
    body: data,
    headers: { Accept: "application/json" }
  }).then(() => {
    form.style.display = "none";
    document.getElementById("gracias").style.display = "block";
    document.getElementById("gracias").scrollIntoView({ behavior: "smooth" });
  });
}

// Cargar partículas tipo red neuronal
window.addEventListener("DOMContentLoaded", () => {
  const script = document.createElement("script");
  script.src = "https://cdn.jsdelivr.net/npm/particles.js@2.0.0/particles.min.js";
  script.onload = () => {
    particlesJS("particles-js", {
      particles: {
        number: { value: 50 },
        color: { value: "#00e5ff" },
        shape: { type: "circle" },
        opacity: { value: 0.3 },
        size: { value: 3 },
        line_linked: {
          enable: true,
          distance: 120,
          color: "#00d6f2",
          opacity: 0.4,
          width: 1
        },
        move: {
          enable: true,
          speed: 1.2,
          direction: "none",
          out_mode: "out"
        }
      },
      interactivity: {
        detect_on: "canvas",
        events: {
          onhover: { enable: true, mode: "grab" },
          onclick: { enable: true, mode: "push" }
        },
        modes: {
          grab: { distance: 140, line_linked: { opacity: 0.5 } },
          push: { particles_nb: 2 }
        }
      },
      retina_detect: true
    });
  };
  document.body.appendChild(script);
});






